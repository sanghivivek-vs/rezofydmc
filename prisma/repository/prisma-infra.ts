/**
 * Prisma-backed persistence for ALL modules (ADR 0009).
 *
 * This file lives OUTSIDE src/ (and the default tsconfig) on purpose: it imports
 * the generated `@prisma/client`, which the build sandbox cannot produce (engine
 * download is blocked by egress policy). It is compiled and type-checked in a
 * DB-enabled environment / CI via `tsconfig.prisma.json` after `prisma generate`,
 * and wired in by `prisma/composition/prisma-persistence.module.ts`.
 *
 * Every repo implements the SAME interface the services already depend on, and
 * applies tenant scoping (org_id) centrally (ADR 0004). The DB-agnostic enquiry
 * mapper is reused; other entities map inline.
 */

import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { type TenantContext, assertSameTenant } from '../../src/common/tenancy/tenant-context';
import { money } from '../../src/common/money/money';
import type { AuditEvent, AuditSink } from '../../src/common/audit/audit-log';
import type { Enquiry } from '../../src/modules/enquiry-intake/domain/enquiry';
import type { EnquiryRepository } from '../../src/modules/enquiry-intake/repository/enquiry.repository';
import type {
  IdempotencyRecord,
  IdempotencyStore,
} from '../../src/modules/enquiry-intake/repository/idempotency-store';
import {
  toDomain as enquiryToDomain,
  toRow as enquiryToRow,
  type EnquiryRow,
} from '../../src/modules/enquiry-intake/repository/enquiry.mapper';
import type { Organization } from '../../src/modules/identity-org/domain/organization';
import type { User } from '../../src/modules/identity-org/domain/user';
import type { OrgRepository } from '../../src/modules/identity-org/repository/org.repository';
import type { UserRepository } from '../../src/modules/identity-org/repository/user.repository';
import type { Supplier } from '../../src/modules/catalog/domain/supplier';
import type { Component } from '../../src/modules/catalog/domain/component';
import type { Rate } from '../../src/modules/catalog/domain/rate';
import type {
  ComponentRepository,
  RateRepository,
  SupplierRepository,
} from '../../src/modules/catalog/repository/catalog.repository';
import type { Quote } from '../../src/modules/quotation/domain/quote';
import type { QuoteRepository } from '../../src/modules/quotation/repository/quote.repository';
import type { Itinerary } from '../../src/modules/itinerary/domain/itinerary';
import type { ItineraryRepository } from '../../src/modules/itinerary/repository/itinerary.repository';
import type { ConsentRecord } from '../../src/modules/gdpr/domain/consent';
import type { ConsentRepository } from '../../src/modules/gdpr/repository/consent.repository';
import type { Booking } from '../../src/modules/operations/domain/booking';
import type { BookingRepository } from '../../src/modules/operations/repository/booking.repository';

const iso = (d: Date | string): string => (typeof d === 'string' ? d : d.toISOString());
const date = (s: string): Date => new Date(s);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

// --------------------------------------------------------------------------
// Enquiry
// --------------------------------------------------------------------------

@Injectable()
export class PrismaEnquiryRepository implements EnquiryRepository {
  constructor(private readonly prisma: PrismaService) {}
  async create(ctx: TenantContext, e: Enquiry): Promise<Enquiry> {
    assertSameTenant(ctx, e);
    const row = await this.prisma.enquiry.create({ data: enquiryToRow(e) as never });
    return enquiryToDomain(row as EnquiryRow);
  }
  async update(ctx: TenantContext, e: Enquiry): Promise<Enquiry> {
    assertSameTenant(ctx, e);
    const res = await this.prisma.enquiry.updateMany({
      where: { id: e.id, orgId: ctx.orgId },
      data: enquiryToRow(e) as never,
    });
    if (res.count === 0) throw new Error(`Enquiry ${e.id} not found for org ${ctx.orgId}`);
    return e;
  }
  async findById(ctx: TenantContext, id: string): Promise<Enquiry | null> {
    const row = await this.prisma.enquiry.findFirst({ where: { id, orgId: ctx.orgId } });
    return row ? enquiryToDomain(row as EnquiryRow) : null;
  }
  async findByExternalId(ctx: TenantContext, externalId: string): Promise<Enquiry | null> {
    const row = await this.prisma.enquiry.findFirst({
      where: { orgId: ctx.orgId, enquiryExternalId: externalId },
    });
    return row ? enquiryToDomain(row as EnquiryRow) : null;
  }
  async list(ctx: TenantContext): Promise<Enquiry[]> {
    const rows = await this.prisma.enquiry.findMany({ where: { orgId: ctx.orgId } });
    return rows.map((r) => enquiryToDomain(r as EnquiryRow));
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

// --------------------------------------------------------------------------
// Identity & Org
// --------------------------------------------------------------------------

@Injectable()
export class PrismaOrgRepository implements OrgRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toDomain(r: { id: string; name: string; settings: unknown; createdAt: Date; updatedAt: Date }): Organization {
    return {
      id: r.id,
      name: r.name,
      settings: r.settings as Organization['settings'],
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
    };
  }
  async create(org: Organization): Promise<Organization> {
    const r = await this.prisma.organization.create({
      data: { id: org.id, name: org.name, settings: org.settings as never, updatedAt: date(org.updatedAt) },
    });
    return this.toDomain(r);
  }
  async update(org: Organization): Promise<Organization> {
    const r = await this.prisma.organization.update({
      where: { id: org.id },
      data: { name: org.name, settings: org.settings as never, updatedAt: date(org.updatedAt) },
    });
    return this.toDomain(r);
  }
  async findById(id: string): Promise<Organization | null> {
    const r = await this.prisma.organization.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }
}

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toDomain(r: Record<string, unknown>): User {
    return {
      id: r.id as string,
      orgId: r.orgId as string,
      email: r.email as string,
      name: r.name as string,
      role: r.role as User['role'],
      status: r.status as User['status'],
      passwordHash: r.passwordHash as string,
      createdAt: iso(r.createdAt as Date),
      updatedAt: iso(r.updatedAt as Date),
    };
  }
  async create(u: User): Promise<User> {
    const r = await this.prisma.user.create({ data: { ...u, updatedAt: date(u.updatedAt) } as never });
    return this.toDomain(r as never);
  }
  async update(ctx: TenantContext, u: User): Promise<User> {
    assertSameTenant(ctx, u);
    const res = await this.prisma.user.updateMany({
      where: { id: u.id, orgId: ctx.orgId },
      data: { ...u, updatedAt: date(u.updatedAt) } as never,
    });
    if (res.count === 0) throw new Error(`User ${u.id} not found for org ${ctx.orgId}`);
    return u;
  }
  async findById(ctx: TenantContext, id: string): Promise<User | null> {
    const r = await this.prisma.user.findFirst({ where: { id, orgId: ctx.orgId } });
    return r ? this.toDomain(r as never) : null;
  }
  async list(ctx: TenantContext): Promise<User[]> {
    const rows = await this.prisma.user.findMany({ where: { orgId: ctx.orgId } });
    return rows.map((r) => this.toDomain(r as never));
  }
  async findByEmailGlobal(email: string): Promise<User | null> {
    const r = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return r ? this.toDomain(r as never) : null;
  }
}

// --------------------------------------------------------------------------
// Catalog
// --------------------------------------------------------------------------

@Injectable()
export class PrismaSupplierRepository implements SupplierRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toDomain(r: Record<string, unknown>): Supplier {
    return {
      id: r.id as string,
      orgId: r.orgId as string,
      name: r.name as string,
      type: (r.type as Supplier['type']) ?? undefined,
      contact: (r.contact as string) ?? undefined,
      currency: r.currency as string,
      region: (r.region as string) ?? undefined,
      createdAt: iso(r.createdAt as Date),
      updatedAt: iso(r.updatedAt as Date),
    };
  }
  async create(ctx: TenantContext, s: Supplier): Promise<Supplier> {
    assertSameTenant(ctx, s);
    const r = await this.prisma.supplier.create({
      data: { ...s, type: s.type ?? null, contact: s.contact ?? null, region: s.region ?? null, updatedAt: date(s.updatedAt) } as never,
    });
    return this.toDomain(r as never);
  }
  async findById(ctx: TenantContext, id: string): Promise<Supplier | null> {
    const r = await this.prisma.supplier.findFirst({ where: { id, orgId: ctx.orgId } });
    return r ? this.toDomain(r as never) : null;
  }
  async list(ctx: TenantContext): Promise<Supplier[]> {
    const rows = await this.prisma.supplier.findMany({ where: { orgId: ctx.orgId } });
    return rows.map((r) => this.toDomain(r as never));
  }
}

@Injectable()
export class PrismaComponentRepository implements ComponentRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toDomain(r: Record<string, unknown>): Component {
    return {
      id: r.id as string,
      orgId: r.orgId as string,
      type: r.type as Component['type'],
      supplierId: r.supplierId as string,
      name: r.name as string,
      unitBasis: r.unitBasis as Component['unitBasis'],
      notes: (r.notes as string) ?? undefined,
      createdAt: iso(r.createdAt as Date),
      updatedAt: iso(r.updatedAt as Date),
    };
  }
  async create(ctx: TenantContext, c: Component): Promise<Component> {
    assertSameTenant(ctx, c);
    const r = await this.prisma.component.create({
      data: { ...c, notes: c.notes ?? null, updatedAt: date(c.updatedAt) } as never,
    });
    return this.toDomain(r as never);
  }
  async findById(ctx: TenantContext, id: string): Promise<Component | null> {
    const r = await this.prisma.component.findFirst({ where: { id, orgId: ctx.orgId } });
    return r ? this.toDomain(r as never) : null;
  }
  async list(ctx: TenantContext): Promise<Component[]> {
    const rows = await this.prisma.component.findMany({ where: { orgId: ctx.orgId } });
    return rows.map((r) => this.toDomain(r as never));
  }
}

@Injectable()
export class PrismaRateRepository implements RateRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toDomain(r: Record<string, unknown>): Rate {
    return {
      id: r.id as string,
      orgId: r.orgId as string,
      componentId: r.componentId as string,
      unitBasis: r.unitBasis as Rate['unitBasis'],
      net: money(r.netAmountMinor as number, r.netCurrency as string),
      validFrom: iso(r.validFrom as Date).slice(0, 10),
      validTo: iso(r.validTo as Date).slice(0, 10),
      season: (r.season as string) ?? undefined,
      childRules: (r.childRules as Rate['childRules']) ?? undefined,
      slabs: deserializeSlabs(r.slabs),
      createdAt: iso(r.createdAt as Date),
      updatedAt: iso(r.updatedAt as Date),
    };
  }
  async create(ctx: TenantContext, rate: Rate): Promise<Rate> {
    assertSameTenant(ctx, rate);
    const r = await this.prisma.rate.create({
      data: {
        id: rate.id,
        orgId: rate.orgId,
        componentId: rate.componentId,
        unitBasis: rate.unitBasis,
        netAmountMinor: rate.net.amountMinor,
        netCurrency: rate.net.currency,
        validFrom: date(rate.validFrom),
        validTo: date(rate.validTo),
        season: rate.season ?? null,
        childRules: (rate.childRules ?? null) as never,
        slabs: serializeSlabs(rate.slabs) as never,
        updatedAt: date(rate.updatedAt),
      } as never,
    });
    return this.toDomain(r as never);
  }
  async listByComponent(ctx: TenantContext, componentId: string): Promise<Rate[]> {
    const rows = await this.prisma.rate.findMany({ where: { orgId: ctx.orgId, componentId } });
    return rows.map((r) => this.toDomain(r as never));
  }
}

function serializeSlabs(slabs: Rate['slabs']): unknown {
  if (!slabs) return null;
  return slabs.map((s) => ({
    minPax: s.minPax,
    maxPax: s.maxPax === Number.POSITIVE_INFINITY ? null : s.maxPax,
    net: { amountMinor: s.net.amountMinor, currency: s.net.currency },
  }));
}
function deserializeSlabs(raw: unknown): Rate['slabs'] {
  if (!raw || !Array.isArray(raw)) return undefined;
  return raw.map((s: { minPax: number; maxPax: number | null; net: { amountMinor: number; currency: string } }) => ({
    minPax: s.minPax,
    maxPax: s.maxPax === null ? Number.POSITIVE_INFINITY : s.maxPax,
    net: money(s.net.amountMinor, s.net.currency),
  }));
}

// --------------------------------------------------------------------------
// Quotation
// --------------------------------------------------------------------------

@Injectable()
export class PrismaQuoteRepository implements QuoteRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toDomain(r: Record<string, unknown>): Quote {
    return {
      id: r.id as string,
      orgId: r.orgId as string,
      enquiryId: r.enquiryId as string,
      version: r.version as number,
      status: r.status as Quote['status'],
      currency: r.currency as string,
      sell: r.sell as Quote['sell'],
      margin: r.margin as Quote['margin'],
      createdBy: r.createdBy as string,
      createdAt: iso(r.createdAt as Date),
    };
  }
  private toRow(q: Quote): Record<string, unknown> {
    return {
      id: q.id,
      orgId: q.orgId,
      enquiryId: q.enquiryId,
      version: q.version,
      status: q.status,
      currency: q.currency,
      sell: q.sell,
      margin: q.margin,
      createdBy: q.createdBy,
      createdAt: date(q.createdAt),
    };
  }
  async create(ctx: TenantContext, q: Quote): Promise<Quote> {
    assertSameTenant(ctx, q);
    const r = await this.prisma.quote.create({ data: this.toRow(q) as never });
    return this.toDomain(r as never);
  }
  async save(ctx: TenantContext, q: Quote): Promise<Quote> {
    assertSameTenant(ctx, q);
    const r = await this.prisma.quote.upsert({
      where: { id: q.id },
      create: this.toRow(q) as never,
      update: { status: q.status, sell: q.sell as never, margin: q.margin as never },
    });
    return this.toDomain(r as never);
  }
  async findById(ctx: TenantContext, id: string): Promise<Quote | null> {
    const r = await this.prisma.quote.findFirst({ where: { id, orgId: ctx.orgId } });
    return r ? this.toDomain(r as never) : null;
  }
  async listByEnquiry(ctx: TenantContext, enquiryId: string): Promise<Quote[]> {
    const rows = await this.prisma.quote.findMany({
      where: { orgId: ctx.orgId, enquiryId },
      orderBy: { version: 'asc' },
    });
    return rows.map((r) => this.toDomain(r as never));
  }
  async latestVersion(ctx: TenantContext, enquiryId: string): Promise<number> {
    const top = await this.prisma.quote.findFirst({
      where: { orgId: ctx.orgId, enquiryId },
      orderBy: { version: 'desc' },
    });
    return top ? (top.version as number) : 0;
  }
}

// --------------------------------------------------------------------------
// Itinerary
// --------------------------------------------------------------------------

@Injectable()
export class PrismaItineraryRepository implements ItineraryRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toDomain(r: Record<string, unknown>): Itinerary {
    return {
      id: r.id as string,
      orgId: r.orgId as string,
      enquiryId: r.enquiryId as string,
      version: r.version as number,
      title: (r.title as string) ?? undefined,
      days: r.days as Itinerary['days'],
      createdAt: iso(r.createdAt as Date),
      updatedAt: iso(r.updatedAt as Date),
    };
  }
  private toRow(i: Itinerary): Record<string, unknown> {
    return {
      id: i.id,
      orgId: i.orgId,
      enquiryId: i.enquiryId,
      version: i.version,
      title: i.title ?? null,
      days: i.days,
      updatedAt: date(i.updatedAt),
    };
  }
  async create(ctx: TenantContext, i: Itinerary): Promise<Itinerary> {
    assertSameTenant(ctx, i);
    const r = await this.prisma.itinerary.create({ data: this.toRow(i) as never });
    return this.toDomain(r as never);
  }
  async save(ctx: TenantContext, i: Itinerary): Promise<Itinerary> {
    assertSameTenant(ctx, i);
    const r = await this.prisma.itinerary.upsert({
      where: { id: i.id },
      create: this.toRow(i) as never,
      update: { days: i.days as never, title: i.title ?? null, updatedAt: date(i.updatedAt) },
    });
    return this.toDomain(r as never);
  }
  async findById(ctx: TenantContext, id: string): Promise<Itinerary | null> {
    const r = await this.prisma.itinerary.findFirst({ where: { id, orgId: ctx.orgId } });
    return r ? this.toDomain(r as never) : null;
  }
  async listByEnquiry(ctx: TenantContext, enquiryId: string): Promise<Itinerary[]> {
    const rows = await this.prisma.itinerary.findMany({
      where: { orgId: ctx.orgId, enquiryId },
      orderBy: { version: 'asc' },
    });
    return rows.map((r) => this.toDomain(r as never));
  }
  async latestVersion(ctx: TenantContext, enquiryId: string): Promise<number> {
    const top = await this.prisma.itinerary.findFirst({
      where: { orgId: ctx.orgId, enquiryId },
      orderBy: { version: 'desc' },
    });
    return top ? (top.version as number) : 0;
  }
}

// --------------------------------------------------------------------------
// GDPR consent + DB audit sink
// --------------------------------------------------------------------------

@Injectable()
export class PrismaConsentRepository implements ConsentRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toDomain(r: Record<string, unknown>): ConsentRecord {
    return {
      id: r.id as string,
      orgId: r.orgId as string,
      subjectType: r.subjectType as ConsentRecord['subjectType'],
      subjectRef: r.subjectRef as string,
      purpose: r.purpose as string,
      lawfulBasis: r.lawfulBasis as ConsentRecord['lawfulBasis'],
      granted: r.granted as boolean,
      recordedBy: r.recordedBy as string,
      recordedAt: iso(r.recordedAt as Date),
    };
  }
  async create(ctx: TenantContext, record: ConsentRecord): Promise<ConsentRecord> {
    assertSameTenant(ctx, record);
    const r = await this.prisma.consentRecord.create({
      data: { ...record, recordedAt: date(record.recordedAt) } as never,
    });
    return this.toDomain(r as never);
  }
  async list(ctx: TenantContext, subjectRef?: string): Promise<ConsentRecord[]> {
    const rows = await this.prisma.consentRecord.findMany({
      where: { orgId: ctx.orgId, ...(subjectRef ? { subjectRef } : {}) },
    });
    return rows.map((r) => this.toDomain(r as never));
  }
}

@Injectable()
export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toDomain(r: Record<string, unknown>): Booking {
    return {
      id: r.id as string,
      orgId: r.orgId as string,
      enquiryId: r.enquiryId as string,
      quoteId: r.quoteId as string,
      status: r.status as Booking['status'],
      items: r.items as Booking['items'],
      createdBy: r.createdBy as string,
      createdAt: iso(r.createdAt as Date),
      updatedAt: iso(r.updatedAt as Date),
    };
  }
  private toRow(b: Booking): Record<string, unknown> {
    return {
      id: b.id,
      orgId: b.orgId,
      enquiryId: b.enquiryId,
      quoteId: b.quoteId,
      status: b.status,
      items: b.items,
      createdBy: b.createdBy,
      createdAt: date(b.createdAt),
      updatedAt: date(b.updatedAt),
    };
  }
  async create(ctx: TenantContext, b: Booking): Promise<Booking> {
    assertSameTenant(ctx, b);
    const r = await this.prisma.booking.create({ data: this.toRow(b) as never });
    return this.toDomain(r as never);
  }
  async save(ctx: TenantContext, b: Booking): Promise<Booking> {
    assertSameTenant(ctx, b);
    const r = await this.prisma.booking.upsert({
      where: { id: b.id },
      create: this.toRow(b) as never,
      update: { status: b.status, items: b.items as never, updatedAt: date(b.updatedAt) },
    });
    return this.toDomain(r as never);
  }
  async findById(ctx: TenantContext, id: string): Promise<Booking | null> {
    const r = await this.prisma.booking.findFirst({ where: { id, orgId: ctx.orgId } });
    return r ? this.toDomain(r as never) : null;
  }
  async findByQuote(ctx: TenantContext, quoteId: string): Promise<Booking | null> {
    const r = await this.prisma.booking.findFirst({ where: { orgId: ctx.orgId, quoteId } });
    return r ? this.toDomain(r as never) : null;
  }
  async list(ctx: TenantContext): Promise<Booking[]> {
    const rows = await this.prisma.booking.findMany({ where: { orgId: ctx.orgId } });
    return rows.map((r) => this.toDomain(r as never));
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
        at: date(event.at),
      },
    });
  }
}
