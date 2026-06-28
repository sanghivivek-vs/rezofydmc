/**
 * Prisma-backed infrastructure for the Enquiry Intake module.
 *
 * This file lives OUTSIDE src/ (and the tsconfig build graph) on purpose: it
 * imports the generated `@prisma/client`, which cannot be produced in the build
 * sandbox (engine-binary download is blocked by egress policy). In a DB-enabled
 * environment, run `npx prisma generate`, then compile this file alongside src
 * and swap these providers into EnquiryModule in place of the in-memory ones.
 *
 * It implements the SAME interfaces the service already depends on
 * (EnquiryRepository, IdempotencyStore, AuditSink), reusing the tested,
 * DB-agnostic mapper. Tenant scoping (org_id) is applied centrally here
 * (ADR 0004) — every query filters by ctx.orgId.
 */

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { TenantContext } from '../../src/common/tenancy/tenant-context';
import { assertSameTenant } from '../../src/common/tenancy/tenant-context';
import type { AuditEvent, AuditSink } from '../../src/common/audit/audit-log';
import type { Enquiry } from '../../src/modules/enquiry-intake/domain/enquiry';
import type { EnquiryRepository } from '../../src/modules/enquiry-intake/repository/enquiry.repository';
import type {
  IdempotencyRecord,
  IdempotencyStore,
} from '../../src/modules/enquiry-intake/repository/idempotency-store';
import {
  toDomain,
  toRow,
  type EnquiryRow,
} from '../../src/modules/enquiry-intake/repository/enquiry.mapper';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

@Injectable()
export class PrismaEnquiryRepository implements EnquiryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(ctx: TenantContext, enquiry: Enquiry): Promise<Enquiry> {
    assertSameTenant(ctx, enquiry);
    const row = await this.prisma.enquiry.create({ data: toRow(enquiry) as never });
    return toDomain(row as EnquiryRow);
  }

  async update(ctx: TenantContext, enquiry: Enquiry): Promise<Enquiry> {
    assertSameTenant(ctx, enquiry);
    // Scope the update by org_id so a wrong tenant can never overwrite a row.
    const result = await this.prisma.enquiry.updateMany({
      where: { id: enquiry.id, orgId: ctx.orgId },
      data: toRow(enquiry) as never,
    });
    if (result.count === 0) {
      throw new Error(`Enquiry ${enquiry.id} not found for org ${ctx.orgId}`);
    }
    return enquiry;
  }

  async findById(ctx: TenantContext, id: string): Promise<Enquiry | null> {
    const row = await this.prisma.enquiry.findFirst({ where: { id, orgId: ctx.orgId } });
    return row ? toDomain(row as EnquiryRow) : null;
  }

  async findByExternalId(ctx: TenantContext, enquiryExternalId: string): Promise<Enquiry | null> {
    const row = await this.prisma.enquiry.findFirst({
      where: { orgId: ctx.orgId, enquiryExternalId },
    });
    return row ? toDomain(row as EnquiryRow) : null;
  }

  async list(ctx: TenantContext): Promise<Enquiry[]> {
    const rows = await this.prisma.enquiry.findMany({ where: { orgId: ctx.orgId } });
    return rows.map((r) => toDomain(r as EnquiryRow));
  }
}

export class PrismaIdempotencyStore implements IdempotencyStore {
  constructor(private readonly prisma: PrismaService) {}

  async get(orgId: string, key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.webhookReceipt.findUnique({
      where: { orgId_idempotencyKey: { orgId, idempotencyKey: key } },
    });
    return row ? { enquiryId: row.enquiryId } : null;
  }

  async put(orgId: string, key: string, record: IdempotencyRecord): Promise<void> {
    await this.prisma.webhookReceipt.create({
      data: { orgId, idempotencyKey: key, enquiryId: record.enquiryId },
    });
  }
}

@Injectable()
export class PrismaAuditSink implements AuditSink {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditEvent): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        orgId: event.orgId,
        actorId: event.actorId,
        action: event.action,
        subjectType: event.subject.type,
        subjectId: event.subject.id,
        before: (event.before ?? null) as never,
        after: (event.after ?? null) as never,
        requestId: event.requestId ?? null,
        at: new Date(event.at),
      },
    });
  }
}
