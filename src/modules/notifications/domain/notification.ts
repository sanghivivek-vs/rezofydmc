/**
 * Notification (Build guide §4 Notifications). In-app notifications are derived
 * from the audit stream (new enquiry/status change, quote created/sent, segment
 * status). They are org-scoped; an optional recipient narrows to one user.
 */

import type { OrgId, UserId } from '@common/tenancy/tenant-context';
import type { AuditAction, AuditEvent } from '@common/audit/audit-log';

export interface Notification {
  readonly id: string;
  readonly orgId: OrgId;
  readonly type: string;
  readonly subject: { type: string; id: string };
  readonly message: string;
  readonly recipientUserId?: UserId;
  readonly read: boolean;
  readonly createdAt: string;
}

/** Audit actions that produce a notification, and how to phrase them. */
const NOTIFIABLE: Partial<Record<AuditAction, (e: AuditEvent) => string>> = {
  'enquiry.status_changed': (e) => `Enquiry ${e.subject.id} → ${status(e.after)}`,
  'quote.created': (e) => `Quote ${e.subject.id} created`,
  'quote.sent': (e) => `Quote ${e.subject.id} sent to the agency`,
  'segment.status_changed': (e) => `Segment ${e.subject.id} → ${bookingStatus(e.after)}`,
};

export function notificationMessage(event: AuditEvent): string | null {
  const phrase = NOTIFIABLE[event.action];
  return phrase ? phrase(event) : null;
}

function status(after?: Record<string, unknown>): string {
  return (after?.status as string) ?? 'updated';
}
function bookingStatus(after?: Record<string, unknown>): string {
  return (after?.bookingStatus as string) ?? 'updated';
}
