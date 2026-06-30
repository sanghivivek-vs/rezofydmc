import { type FormEvent, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Package, Plus, Tags, Truck } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Component, Rate, Supplier } from '../api/types';
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Field,
  Input,
  PageHeader,
  Select,
  money,
} from '../components/ui';

const UNIT_BASES = ['per_pax', 'per_group', 'per_vehicle', 'per_night', 'per_hour', 'per_km'];
const TYPES = ['Transport', 'Ticket', 'Meal', 'Event', 'Guide', 'Hotel', 'EntranceFee', 'Misc'];

export function CatalogPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [error, setError] = useState('');
  const [showSupplier, setShowSupplier] = useState(false);
  const [showComponent, setShowComponent] = useState(false);

  async function load() {
    try {
      const [s, c] = await Promise.all([api.listSuppliers(), api.listComponents()]);
      setSuppliers(s);
      setComponents(c);
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? '—';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Catalog"
        subtitle="Suppliers, services, and rate cards that power your quotes."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Truck} label="Suppliers" value={suppliers.length} />
        <Stat icon={Package} label="Components" value={components.length} />
        <Stat
          icon={Tags}
          label="Currencies"
          value={new Set(suppliers.map((s) => s.currency)).size}
        />
      </div>

      <ErrorText>{error}</ErrorText>

      {/* Suppliers */}
      <Card
        title="Suppliers"
        description="Hotels, transport, guides, activities…"
        actions={
          <Button
            size="sm"
            variant={showSupplier ? 'ghost' : 'primary'}
            onClick={() => setShowSupplier((v) => !v)}
          >
            <Plus className="h-4 w-4" /> Add supplier
          </Button>
        }
      >
        {showSupplier && (
          <SupplierForm
            onDone={async () => {
              setShowSupplier(false);
              await load();
            }}
            onError={setError}
          />
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1.5">Name</th>
              <th>Type</th>
              <th>Currency</th>
              <th>Region</th>
              <th>Contact</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="py-2 font-medium text-slate-800">{s.name}</td>
                <td>
                  {s.type ? <Badge>{s.type}</Badge> : <span className="text-slate-300">—</span>}
                </td>
                <td className="text-slate-600">{s.currency}</td>
                <td className="text-slate-500">{s.region ?? '—'}</td>
                <td className="text-slate-500">{s.contact ?? '—'}</td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-slate-400">
                  No suppliers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Components + rates */}
      <Card
        title="Components & rate cards"
        description="Expand a component to manage its rates."
        actions={
          <Button
            size="sm"
            variant={showComponent ? 'ghost' : 'primary'}
            onClick={() => setShowComponent((v) => !v)}
            disabled={suppliers.length === 0}
          >
            <Plus className="h-4 w-4" /> Add component
          </Button>
        }
      >
        {suppliers.length === 0 && (
          <p className="text-sm text-slate-400">Add a supplier first, then create components.</p>
        )}
        {showComponent && (
          <ComponentForm
            suppliers={suppliers}
            onDone={async () => {
              setShowComponent(false);
              await load();
            }}
            onError={setError}
          />
        )}
        <div className="divide-y divide-slate-100">
          {components.map((c) => (
            <ComponentRow
              key={c.id}
              component={c}
              supplierName={supplierName(c.supplierId)}
              supplierCurrency={suppliers.find((s) => s.id === c.supplierId)?.currency ?? 'USD'}
              onError={setError}
            />
          ))}
          {components.length === 0 && (
            <p className="py-3 text-sm text-slate-400">No components yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function ComponentRow({
  component,
  supplierName,
  supplierCurrency,
  onError,
}: {
  component: Component;
  supplierName: string;
  supplierCurrency: string;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rates, setRates] = useState<Rate[] | null>(null);

  async function loadRates() {
    try {
      setRates(await api.listRates(component.id));
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to load rates');
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && rates === null) void loadRates();
  }

  return (
    <div>
      <button onClick={toggle} className="flex w-full items-center gap-3 py-3 text-left">
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
        <div className="flex-1">
          <div className="font-medium text-slate-800">{component.name}</div>
          <div className="text-xs text-slate-400">
            {supplierName} · {component.unitBasis.replace('per_', 'per ')}
          </div>
        </div>
        <Badge>{component.type}</Badge>
      </button>

      {open && (
        <div className="mb-3 ml-7 rounded-xl bg-slate-50/70 p-3">
          {rates === null ? (
            <p className="text-sm text-slate-400">Loading rates…</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-1">Net</th>
                  <th>Valid from</th>
                  <th>Valid to</th>
                  <th>Season</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-1.5 font-medium tabular-nums">{money(r.net)}</td>
                    <td className="text-slate-600">{r.validFrom}</td>
                    <td className="text-slate-600">{r.validTo}</td>
                    <td className="text-slate-500">{r.season ?? '—'}</td>
                  </tr>
                ))}
                {rates.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-2 text-slate-400">
                      No rates — add one below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          <RateForm
            componentId={component.id}
            currency={supplierCurrency}
            onDone={loadRates}
            onError={onError}
          />
        </div>
      )}
    </div>
  );
}

function SupplierForm({
  onDone,
  onError,
}: {
  onDone: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('Hotel');
  const [currency, setCurrency] = useState('INR');
  const [region, setRegion] = useState('');
  const [contact, setContact] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createSupplier({
        name,
        type,
        currency,
        region: region || undefined,
        contact: contact || undefined,
      });
      await onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to add supplier');
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-4 grid gap-3 rounded-xl bg-slate-50/70 p-3 sm:grid-cols-3 lg:grid-cols-5"
    >
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Type">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="Currency">
        <Input
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          required
        />
      </Field>
      <Field label="Region">
        <Input value={region} onChange={(e) => setRegion(e.target.value)} />
      </Field>
      <Field label="Contact">
        <Input value={contact} onChange={(e) => setContact(e.target.value)} />
      </Field>
      <div className="sm:col-span-3 lg:col-span-5">
        <Button type="submit" size="sm">
          Save supplier
        </Button>
      </div>
    </form>
  );
}

function ComponentForm({
  suppliers,
  onDone,
  onError,
}: {
  suppliers: Supplier[];
  onDone: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('Ticket');
  const [supplierId, setSupplierId] = useState('');
  const [unitBasis, setUnitBasis] = useState('per_pax');

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createComponent({ name, type, supplierId, unitBasis });
      await onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to add component');
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-4 grid gap-3 rounded-xl bg-slate-50/70 p-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Supplier">
        <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
          <option value="">Select…</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Type">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="Unit basis">
        <Select value={unitBasis} onChange={(e) => setUnitBasis(e.target.value)}>
          {UNIT_BASES.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2 lg:col-span-4">
        <Button type="submit" size="sm">
          Save component
        </Button>
      </div>
    </form>
  );
}

function RateForm({
  componentId,
  currency,
  onDone,
  onError,
}: {
  componentId: string;
  currency: string;
  onDone: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [amount, setAmount] = useState(1000);
  const [validFrom, setValidFrom] = useState('2026-01-01');
  const [validTo, setValidTo] = useState('2026-12-31');
  const [season, setSeason] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.addRate(componentId, {
        net: { amountMinor: Math.round(amount * 100), currency },
        validFrom,
        validTo,
        season: season || undefined,
      });
      setAmount(1000);
      setSeason('');
      await onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to add rate');
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <Field label={`Net (${currency})`}>
        <Input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </Field>
      <Field label="Valid from">
        <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
      </Field>
      <Field label="Valid to">
        <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
      </Field>
      <Field label="Season">
        <Input
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          placeholder="Peak / Off"
        />
      </Field>
      <Button type="submit" size="sm">
        Add rate
      </Button>
    </form>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}
