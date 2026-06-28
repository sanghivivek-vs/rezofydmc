/**
 * REST request DTOs for the Enquiry API. Validation is centralised in the
 * service / money constructors — these are the wire shapes only.
 */

import { money } from '@common/money/money';
import { ValidationError } from '@common/errors/errors';
import type { CreateEnquiryInput, EnquiryPax, DateRange, Rooming } from '../domain/enquiry';
import type { EnquiryStatus, TransportMode } from '../domain/enums';

export interface MoneyDto {
  amountMinor: number;
  currency: string;
}

export interface CreateEnquiryDto {
  enquiryExternalId?: string;
  agencyId: string;
  destinations: string[];
  dateRange?: DateRange;
  durationDays?: number;
  pax: EnquiryPax;
  rooming?: Rooming;
  hotelCategory?: string;
  namedHotels?: string[];
  mealPreference?: string;
  transportPreference?: { mode: TransportMode; coachSize?: number };
  budget?: MoneyDto;
  mustSeeInclusions?: string[];
  specialRequirements?: string;
  quoteDeadline: string;
}

export interface AssignDto {
  userId: string;
}

export interface ChangeStatusDto {
  status: EnquiryStatus;
}

/** Map a create DTO to the service input, converting budget to Money. */
export function toCreateEnquiryInput(dto: CreateEnquiryDto): CreateEnquiryInput {
  if (!dto || typeof dto !== 'object') {
    throw new ValidationError('Request body is required');
  }
  const { budget, ...rest } = dto;
  return {
    ...rest,
    budget: budget ? money(budget.amountMinor, budget.currency) : undefined,
  };
}
