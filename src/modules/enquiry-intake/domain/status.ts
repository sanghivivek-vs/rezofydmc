/**
 * Enquiry status state machine (Build guide §3 EnquiryStatus).
 *
 * Transitions are explicit and validated at the service boundary. Status changes
 * are audited (Build guide §9).
 */

import { BusinessRuleError } from '@common/errors/errors';
import type { EnquiryStatus } from './enums';

/** Allowed next-states for each status. Empty array = terminal. */
const TRANSITIONS: Record<EnquiryStatus, readonly EnquiryStatus[]> = {
  New: ['In Progress', 'Lost', 'Expired'],
  'In Progress': ['Quoted', 'Lost', 'Expired'],
  Quoted: ['Revision Requested', 'Won', 'Lost', 'Expired'],
  'Revision Requested': ['In Progress', 'Quoted', 'Lost', 'Expired'],
  Won: [],
  Lost: [],
  Expired: ['In Progress'], // an expired enquiry may be reopened
};

export function canTransition(from: EnquiryStatus, to: EnquiryStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: EnquiryStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function assertTransition(from: EnquiryStatus, to: EnquiryStatus): void {
  if (from === to) {
    throw new BusinessRuleError(`Enquiry is already in status "${from}"`, { from, to });
  }
  if (!canTransition(from, to)) {
    throw new BusinessRuleError(`Illegal enquiry status transition: ${from} -> ${to}`, {
      from,
      to,
      allowed: TRANSITIONS[from],
    });
  }
}
