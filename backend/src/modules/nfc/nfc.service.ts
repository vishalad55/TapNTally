import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod, TbefBillV1, TransactionSource, validateTbefBill } from '@tapntally/shared';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/auth/current-user.decorator';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { AppError } from '../../common/filters/http-exception.filter';
import { AppConfigService } from '../../config/app-config.service';
import { PosTerminalEntity, TransactionEntity } from '../../database/entities';
import { TransactionsService } from '../transactions/transactions.service';
import { signTbef, verifyTbef } from './tbef-signature';

export interface NfcIngestOutcome {
  transaction: TransactionEntity;
  created: boolean;
  signatureVerified: boolean;
}

@Injectable()
export class NfcService {
  private readonly logger = new Logger(NfcService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly crypto: EncryptionService,
    private readonly transactions: TransactionsService,
    @InjectRepository(PosTerminalEntity) private readonly terminals: Repository<PosTerminalEntity>,
  ) {}

  /**
   * Turn a tapped bill into a transaction.
   *
   * Trust model: a bill from an enrolled terminal with a valid HMAC is
   * `signatureVerified`. Unsigned/unknown-terminal bills are still accepted
   * (the user physically tapped a terminal and wants their receipt) unless
   * NFC_REQUIRE_SIGNATURE is on — expected to be on once partner rollouts
   * begin, off during pilots and demos.
   */
  async ingestBill(me: AuthUser, rawBill: unknown, idempotencyKey: string): Promise<NfcIngestOutcome> {
    const validation = validateTbefBill(rawBill);
    if (!validation.ok) {
      throw new AppError('NFC_MALFORMED_BILL', 'This terminal sent a bill we could not read', HttpStatus.UNPROCESSABLE_ENTITY, {
        errors: validation.errors,
      });
    }
    const bill = validation.bill;
    const requireSig = this.config.get('NFC_REQUIRE_SIGNATURE');

    const terminal = await this.terminals.findOne({
      where: { network: bill.terminal.network, terminalId: bill.terminal.terminalId },
    });

    let signatureVerified = false;
    if (terminal && terminal.active) {
      const secret = this.crypto.decrypt(terminal.encryptedSecret);
      signatureVerified = verifyTbef(bill, secret);
      if (!signatureVerified && requireSig) {
        this.logger.warn(`Bad signature from terminal ${bill.terminal.network}/${bill.terminal.terminalId}`);
        throw new AppError('NFC_BAD_SIGNATURE', 'This bill failed verification', HttpStatus.UNPROCESSABLE_ENTITY);
      }
    } else if (requireSig) {
      throw new AppError('NFC_UNKNOWN_TERMINAL', 'This terminal is not yet supported by TapNTally', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const { transaction, created } = await this.transactions.ingest({
      userId: me.id,
      source: TransactionSource.NFC,
      merchant: bill.merchant.name,
      amountPaise: bill.totalPaise,
      occurredAt: new Date(bill.issuedAt),
      paymentMethod: bill.paymentMethod,
      items: bill.items.map((i) => ({ name: i.name, qty: i.qty, unitPaise: i.unitPaise, totalPaise: i.totalPaise, sku: i.sku })),
      mcc: bill.merchant.mcc,
      rawSourceRef: bill.billId,
      dedupeKey: `nfc:${bill.terminal.network}:${bill.terminal.terminalId}:${bill.billId}`,
      idempotencyKey,
      signatureVerified,
      terminalNetwork: bill.terminal.network,
      terminalId: bill.terminal.terminalId,
    });

    if (created && terminal) {
      await this.terminals.increment({ id: terminal.id }, 'billsReceived', 1);
    }
    return { transaction, created, signatureVerified };
  }

  /**
   * Dev/demo helper: a realistic, correctly signed bill from the seeded demo
   * terminal, so the tap flow can be exercised without hardware.
   */
  async demoBill(): Promise<TbefBillV1> {
    const terminal = await this.terminals.findOne({ where: { network: 'demo', terminalId: 'DEMO-001' } });
    const now = new Date();
    const items = [
      { name: 'Masala Dosa', qty: 2, unitPaise: 9000, totalPaise: 18000 },
      { name: 'Filter Coffee', qty: 2, unitPaise: 3500, totalPaise: 7000 },
      { name: 'Mysore Pak (250g)', qty: 1, unitPaise: 12000, totalPaise: 12000 },
    ];
    const subtotal = items.reduce((s, i) => s + i.totalPaise, 0);
    const tax = Math.round(subtotal * 0.05);
    const bill: Omit<TbefBillV1, 'sig'> = {
      v: 1,
      billId: `DEMO-${now.getTime().toString(36).toUpperCase()}`,
      issuedAt: now.toISOString(),
      currency: 'INR',
      merchant: { name: 'Vidyarthi Bhavan', merchantId: 'demo-vb-001', mcc: '5812', address: 'Gandhi Bazaar, Bengaluru' },
      terminal: { network: 'demo', terminalId: 'DEMO-001' },
      items,
      subtotalPaise: subtotal,
      taxPaise: tax,
      discountPaise: 0,
      totalPaise: subtotal + tax,
      paymentMethod: PaymentMethod.CARD,
    };
    const sig = terminal ? signTbef(bill, this.crypto.decrypt(terminal.encryptedSecret)) : undefined;
    return { ...bill, sig };
  }
}
