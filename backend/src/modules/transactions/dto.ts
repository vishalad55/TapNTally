import { PaymentMethod, TransactionSource } from '@tapntally/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class TransactionItemDto {
  @IsString() @MinLength(1) @MaxLength(200)
  name: string;

  @Type(() => Number) @Min(0.001)
  qty: number;

  @IsInt() @Min(0)
  unitPaise: number;

  @IsInt() @Min(0)
  totalPaise: number;

  @IsOptional() @IsString() @MaxLength(80)
  sku?: string;
}

export class CreateManualTransactionDto {
  @IsString() @MinLength(1) @MaxLength(200)
  merchant: string;

  @IsInt() @Min(1) @Max(2_000_000_000)
  amountPaise: number;

  @IsOptional() @IsUUID()
  categoryId?: string;

  @IsOptional() @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional() @IsISO8601()
  occurredAt?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => TransactionItemDto)
  items?: TransactionItemDto[];

  @IsOptional() @IsBoolean()
  isShared?: boolean;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(30, { each: true })
  tags?: string[];

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;
}

export class UpdateTransactionDto {
  @IsOptional() @IsUUID()
  categoryId?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(30, { each: true })
  tags?: string[];

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string | null;

  @IsOptional() @IsBoolean()
  isShared?: boolean;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  merchant?: string;

  @IsOptional() @IsInt() @Min(1) @Max(2_000_000_000)
  amountPaise?: number;

  @IsOptional() @IsISO8601()
  occurredAt?: string;

  @IsOptional() @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

const toArray = ({ value }: { value: unknown }) =>
  value === undefined ? undefined : Array.isArray(value) ? value : String(value).split(',').filter(Boolean);

export class TransactionQueryDto {
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @Transform(toArray) @IsArray() @IsUUID('4', { each: true })
  categoryIds?: string[];

  @IsOptional() @Transform(toArray) @IsArray() @IsEnum(TransactionSource, { each: true })
  sources?: TransactionSource[];

  @IsOptional() @Transform(toArray) @IsArray() @IsEnum(PaymentMethod, { each: true })
  paymentMethods?: PaymentMethod[];

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  minPaise?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  maxPaise?: number;

  @IsOptional() @IsISO8601()
  from?: string;

  @IsOptional() @IsISO8601()
  to?: string;

  @IsOptional() @IsIn(['personal', 'shared', 'all'])
  scope?: 'personal' | 'shared' | 'all';

  @IsOptional() @IsString()
  cursor?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}

export class SummaryQueryDto {
  @IsOptional() @IsIn(['month', 'week'])
  period?: 'month' | 'week';

  /** 0 = current period, -1 = previous, etc. */
  @IsOptional() @Type(() => Number) @IsInt() @Max(0) @Min(-24)
  offset?: number;

  @IsOptional() @IsIn(['personal', 'shared'])
  scope?: 'personal' | 'shared';
}
