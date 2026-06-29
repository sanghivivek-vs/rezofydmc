import { type FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Component, Supplier } from '../api/types';
import { Button, Card, ErrorText, Field, Input } from '../components/ui';

const UNIT_BASES = ['per_pax', 'per_group', 'per_vehicle', 'per_night', 'per_hour', 'per_km'];
const TYPES = ['Transport', 'Ticket', 'Meal', 'Event', 'Guide', 'Hotel', 'EntranceFee', 'Misc'];

export function CatalogPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [error, setError] = useState('');

  // supplier form
  const [supName, setSupName] = useState('');
  const [supCurrency, setSupCurrency] = useState('CHF');
  // component form
  const [cmpName, setCmpName] = useState('');
  const [cmpType, setCmpType] = useState('Ticket');
  const [cmpSupplier, setCmpSupplier] = useState('');
  const [cmpUnit, setCmpUnit] = useState('per_pax');
  // rate form
  const [rateComponent, setRateComponent] = useState('');
  const [rateAmount, setRateAmount] = useState(100);
  const [rateCurrency, setRateCurrency] = useState('CHF');
  const [rateFrom, setRateFrom] = useState('2026-01-01');
  const [rateTo, setRateTo] = useState('2026-12-31');

  async function load() {
    try {
      const [s, c] = await Promise.all([api.listSuppliers(), api.listComponents()]);
      setSuppliers(s);
      setComponents(c);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const guard = (fn: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed');
    }
  };

  return (
    <div className="space-y-4">
      <ErrorText>{error}</ErrorText>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Suppliers">
          <ul className="mb-3 space-y-1 text-sm">
            {suppliers.map((s) => (
              <li key={s.id} className="flex justify-between border-b border-gray-100 py-1">
                <span>{s.name}</span>
                <span className="text-gray-400">{s.currency}</span>
              </li>
            ))}
          </ul>
          <form
            className="space-y-2"
            onSubmit={guard(async () => {
              await api.createSupplier({ name: supName, currency: supCurrency });
              setSupName('');
            })}
          >
            <Field label="Name">
              <Input value={supName} onChange={(e) => setSupName(e.target.value)} required />
            </Field>
            <Field label="Currency">
              <Input
                value={supCurrency}
                onChange={(e) => setSupCurrency(e.target.value)}
                required
              />
            </Field>
            <Button type="submit">Add supplier</Button>
          </form>
        </Card>

        <Card title="Components">
          <ul className="mb-3 space-y-1 text-sm">
            {components.map((c) => (
              <li key={c.id} className="flex justify-between border-b border-gray-100 py-1">
                <span>
                  {c.name} <span className="text-gray-400">({c.type})</span>
                </span>
                <span className="text-gray-400">{c.unitBasis}</span>
              </li>
            ))}
          </ul>
          <form
            className="space-y-2"
            onSubmit={guard(async () => {
              await api.createComponent({
                name: cmpName,
                type: cmpType,
                supplierId: cmpSupplier,
                unitBasis: cmpUnit,
              });
              setCmpName('');
            })}
          >
            <Field label="Name">
              <Input value={cmpName} onChange={(e) => setCmpName(e.target.value)} required />
            </Field>
            <Field label="Type">
              <select
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                value={cmpType}
                onChange={(e) => setCmpType(e.target.value)}
              >
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Supplier">
              <select
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                value={cmpSupplier}
                onChange={(e) => setCmpSupplier(e.target.value)}
                required
              >
                <option value="">Select…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unit basis">
              <select
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                value={cmpUnit}
                onChange={(e) => setCmpUnit(e.target.value)}
              >
                {UNIT_BASES.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </Field>
            <Button type="submit">Add component</Button>
          </form>
        </Card>
      </div>

      <Card title="Add rate to a component">
        <form
          className="grid gap-2 md:grid-cols-5"
          onSubmit={guard(async () => {
            await api.addRate(rateComponent, {
              net: { amountMinor: Math.round(rateAmount * 100), currency: rateCurrency },
              validFrom: rateFrom,
              validTo: rateTo,
            });
          })}
        >
          <Field label="Component">
            <select
              className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
              value={rateComponent}
              onChange={(e) => setRateComponent(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {components.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Net (major units)">
            <Input
              type="number"
              step="0.01"
              value={rateAmount}
              onChange={(e) => setRateAmount(Number(e.target.value))}
            />
          </Field>
          <Field label="Currency">
            <Input value={rateCurrency} onChange={(e) => setRateCurrency(e.target.value)} />
          </Field>
          <Field label="Valid from">
            <Input type="date" value={rateFrom} onChange={(e) => setRateFrom(e.target.value)} />
          </Field>
          <Field label="Valid to">
            <Input type="date" value={rateTo} onChange={(e) => setRateTo(e.target.value)} />
          </Field>
          <div className="md:col-span-5">
            <Button type="submit">Add rate</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
