/**
 * Catalog REST DTOs. Money arrives on the wire as { amountMinor, currency } and
 * is converted to the internal Money type; deeper validation is in the service.
 */

import { money } from '@common/money/money';
import { ValidationError } from '@common/errors/errors';
import type { ComponentType, UnitBasis, ChildRule } from '@modules/costing';
import type { CreateSupplierInput } from '../domain/supplier';
import type { CreateComponentInput } from '../domain/component';
import type { CreateRateInput } from '../domain/rate';

interface MoneyDto {
  amountMinor: number;
  currency: string;
}

export interface CreateSupplierDto extends CreateSupplierInput {}
export interface CreateComponentDto extends CreateComponentInput {}

export interface CreateRateDto {
  net: MoneyDto;
  validFrom: string;
  validTo: string;
  season?: string;
  childRules?: ChildRule[];
  slabs?: Array<{ minPax: number; maxPax: number; net: MoneyDto }>;
}

function toMoney(dto: MoneyDto, field: string) {
  if (!dto || typeof dto.amountMinor !== 'number' || typeof dto.currency !== 'string') {
    throw new ValidationError(`"${field}" must be { amountMinor, currency }`, { field });
  }
  return money(dto.amountMinor, dto.currency);
}

/** Map the rate DTO + path componentId into the service input. */
export function toCreateRateInput(componentId: string, dto: CreateRateDto): CreateRateInput {
  if (!dto || typeof dto !== 'object') {
    throw new ValidationError('Rate body is required');
  }
  return {
    componentId,
    net: toMoney(dto.net, 'net'),
    validFrom: dto.validFrom,
    validTo: dto.validTo,
    season: dto.season,
    childRules: dto.childRules,
    slabs: dto.slabs?.map((s) => ({
      minPax: s.minPax,
      maxPax: s.maxPax,
      net: toMoney(s.net, 'slabs[].net'),
    })),
  };
}

// Re-export the shared enums for controllers/consumers.
export type { ComponentType, UnitBasis };
