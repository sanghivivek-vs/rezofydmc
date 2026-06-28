/**
 * Logging AuditSink — structured audit output via the Nest logger.
 *
 * Used as the runtime audit sink until the persistence slice provides a
 * DB-backed sink (an `audit_log` table — see prisma/schema.prisma). Logging is
 * structured with org_id + request id (Build guide §9 observability).
 */

import { Injectable, Logger } from '@nestjs/common';
import type { AuditEvent, AuditSink } from './audit-log';

@Injectable()
export class LoggingAuditSink implements AuditSink {
  private readonly logger = new Logger('Audit');

  async record(event: AuditEvent): Promise<void> {
    this.logger.log(
      JSON.stringify({
        orgId: event.orgId,
        requestId: event.requestId,
        actorId: event.actorId,
        action: event.action,
        subject: event.subject,
        before: event.before,
        after: event.after,
        at: event.at,
      }),
    );
  }
}
