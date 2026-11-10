import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:nfc_manager_ndef/nfc_manager_ndef.dart';

import 'api.dart';
import 'models.dart';

/// MIME type a TapNTally terminal writes into its NDEF record (TBEF v1).
const tbefMimeType = 'application/vnd.tapntally.bill+json';

enum NfcReadStatus { success, noTagFound, unsupportedTerminal, malformedBill, nfcUnavailable, cancelled }

class NfcReadResult {
  const NfcReadResult.success(Json this.bill)
      : status = NfcReadStatus.success,
        message = '',
        errors = const [];
  const NfcReadResult.failure(this.status, this.message, [this.errors = const []]) : bill = null;

  final NfcReadStatus status;
  final Json? bill;
  final String message;
  final List<String> errors;
}

/// Mirror of `validateTbefBill` in `shared/src/logic/tbef.ts`; the backend
/// re-validates and verifies the signature, this just fails fast on-device.
List<String> validateTbefBill(Object? input) {
  final errors = <String>[];
  if (input is! Map) return ['bill must be an object'];
  bool isStr(Object? v) => v is String && v.trim().isNotEmpty;
  bool isNonNegInt(Object? v) => v is int && v >= 0;

  if (input['v'] != 1) errors.add('unsupported version: ${input['v']}');
  if (!isStr(input['billId'])) errors.add('billId required');
  if (!isStr(input['issuedAt']) || DateTime.tryParse(input['issuedAt'] as String) == null) errors.add('issuedAt must be ISO-8601');
  if (input['currency'] != 'INR') errors.add('currency must be INR');
  final merchant = input['merchant'];
  if (merchant is! Map || !isStr(merchant['name'])) errors.add('merchant.name required');
  final terminal = input['terminal'];
  if (terminal is! Map || !isStr(terminal['network']) || !isStr(terminal['terminalId'])) {
    errors.add('terminal.network and terminal.terminalId required');
  }
  final items = input['items'];
  if (items is! List) {
    errors.add('items must be an array');
  } else {
    for (var i = 0; i < items.length; i++) {
      final it = items[i];
      if (it is! Map || !isStr(it['name']) || it['qty'] is! num || !isNonNegInt(it['unitPaise']) || !isNonNegInt(it['totalPaise'])) {
        errors.add('items[$i] invalid');
      }
    }
  }
  for (final f in const ['subtotalPaise', 'taxPaise', 'discountPaise', 'totalPaise']) {
    if (!isNonNegInt(input[f])) errors.add('$f must be a non-negative integer');
  }
  if (!PaymentMethod.values.any((m) => m.wire == input['paymentMethod'])) errors.add('paymentMethod invalid');

  if (errors.isEmpty) {
    final list = (items as List).cast<Map>();
    final sum = list.fold<int>(0, (s, it) => s + (it['totalPaise'] as int));
    final subtotal = input['subtotalPaise'] as int;
    if ((sum - subtotal).abs() > list.length) errors.add('items sum $sum does not match subtotalPaise $subtotal');
    final expected = subtotal + (input['taxPaise'] as int) - (input['discountPaise'] as int);
    if (expected != input['totalPaise']) errors.add('totalPaise ${input['totalPaise']} != subtotal + tax - discount ($expected)');
  }
  return errors;
}

/// One interface, two drivers (real hardware and the demo terminal).
abstract class NfcReader {
  bool get isMock;
  Future<bool> isAvailable();

  /// Resolves when a bill is read or the session ends. Never throws.
  Future<NfcReadResult> read();
  Future<void> cancel();
}

const _missedTap = "We didn't catch the bill. Hold your phone still against the terminal and try again.";

class RealNfcReader implements NfcReader {
  Completer<NfcReadResult>? _pending;

  @override
  bool get isMock => false;

  @override
  Future<bool> isAvailable() async {
    if (kIsWeb) return false;
    try {
      return await NfcManager.instance.checkAvailability() == NfcAvailability.enabled;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<NfcReadResult> read() async {
    if (!await isAvailable()) {
      return const NfcReadResult.failure(NfcReadStatus.nfcUnavailable, 'NFC is off or not supported on this phone. Turn it on in system settings.');
    }
    final done = _pending = Completer<NfcReadResult>();
    void finish(NfcReadResult r) {
      if (!done.isCompleted) done.complete(r);
    }

    try {
      await NfcManager.instance.startSession(
        pollingOptions: {NfcPollingOption.iso14443},
        alertMessageIos: 'Hold your phone near the payment terminal',
        onSessionErrorIos: (e) => finish(const NfcReadResult.failure(NfcReadStatus.cancelled, 'Scan cancelled.')),
        onDiscovered: (tag) async {
          try {
            final ndef = Ndef.from(tag);
            final message = ndef == null ? null : (ndef.cachedMessage ?? await ndef.read());
            final records = message?.records ?? const [];
            if (records.isEmpty) return finish(const NfcReadResult.failure(NfcReadStatus.noTagFound, _missedTap));
            final record = records.where((r) => utf8.decode(r.type, allowMalformed: true) == tbefMimeType).firstOrNull;
            if (record == null) {
              return finish(const NfcReadResult.failure(NfcReadStatus.unsupportedTerminal, "This terminal isn't TapNTally-enabled yet."));
            }
            final Object? parsed;
            try {
              parsed = jsonDecode(utf8.decode(record.payload));
            } catch (_) {
              return finish(const NfcReadResult.failure(NfcReadStatus.malformedBill, 'The terminal sent a bill we could not read.', ['invalid JSON']));
            }
            final errors = validateTbefBill(parsed);
            if (errors.isNotEmpty) {
              return finish(NfcReadResult.failure(NfcReadStatus.malformedBill, 'The terminal sent a bill we could not read.', errors));
            }
            finish(NfcReadResult.success((parsed as Map).cast<String, dynamic>()));
          } catch (_) {
            finish(const NfcReadResult.failure(NfcReadStatus.noTagFound, _missedTap));
          } finally {
            await _stop();
          }
        },
      );
    } catch (_) {
      finish(const NfcReadResult.failure(NfcReadStatus.nfcUnavailable, 'Could not start NFC on this phone.'));
    }
    return done.future;
  }

  Future<void> _stop() async {
    try {
      await NfcManager.instance.stopSession();
    } catch (_) {
      /* session already closed */
    }
  }

  @override
  Future<void> cancel() async {
    final p = _pending;
    if (p != null && !p.isCompleted) p.complete(const NfcReadResult.failure(NfcReadStatus.cancelled, 'Scan cancelled.'));
    await _stop();
  }
}

/// Failure scenarios a presenter can pick in Settings to show error handling.
enum DemoScenario {
  signed('Signed bill'),
  unsigned('Unsigned bill'),
  noTag('Missed tap'),
  unsupported('Unsupported terminal'),
  malformed('Malformed bill');

  const DemoScenario(this.label);
  final String label;
}

/// Simulated terminal: asks the backend for a *signed* demo bill so the
/// "verified" path runs end to end, on any device, simulator or browser.
class DemoTerminal implements NfcReader {
  DemoTerminal(this.api, {this.tapDelay = const Duration(milliseconds: 1400)});
  final TallyApi api;
  final Duration tapDelay;
  DemoScenario scenario = DemoScenario.signed;
  bool _cancelled = false;

  @override
  bool get isMock => true;

  @override
  Future<bool> isAvailable() async => true;

  @override
  Future<NfcReadResult> read() async {
    _cancelled = false;
    await Future<void>.delayed(tapDelay);
    if (_cancelled) return const NfcReadResult.failure(NfcReadStatus.cancelled, 'Scan cancelled.');
    switch (scenario) {
      case DemoScenario.noTag:
        return const NfcReadResult.failure(NfcReadStatus.noTagFound, _missedTap);
      case DemoScenario.unsupported:
        return const NfcReadResult.failure(NfcReadStatus.unsupportedTerminal, "This terminal isn't TapNTally-enabled yet.");
      case DemoScenario.malformed:
        return const NfcReadResult.failure(NfcReadStatus.malformedBill, 'The terminal sent a bill we could not read.', ['totalPaise does not reconcile']);
      case DemoScenario.unsigned:
      case DemoScenario.signed:
        try {
          final bill = Map<String, dynamic>.of(await api.demoBill());
          if (scenario == DemoScenario.unsigned) bill.remove('sig');
          final errors = validateTbefBill(bill);
          if (errors.isNotEmpty) return NfcReadResult.failure(NfcReadStatus.malformedBill, 'Demo bill failed validation.', errors);
          return NfcReadResult.success(bill);
        } catch (e) {
          return NfcReadResult.failure(NfcReadStatus.noTagFound, friendlyError(e, "Couldn't reach the demo terminal."));
        }
    }
  }

  @override
  Future<void> cancel() async => _cancelled = true;
}
