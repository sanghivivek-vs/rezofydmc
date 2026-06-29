#!/usr/bin/env node
/**
 * Seed a realistic demo tenant ("Wanderlust DMC") so the app isn't empty.
 * Calls the public HTTP API — works against any running instance.
 *
 *   BASE=http://localhost:3000 node scripts/seed-demo.mjs
 *   (or: npm run seed)
 *
 * Re-running adds more data. For a clean slate, restart an in-memory server first.
 * Login after it runs:  owner@demo.test / demo1234   (super-admin steps unchanged)
 */

const BASE = process.env.BASE || 'http://localhost:3000';
const OWNER = { email: 'owner@demo.test', name: 'Olivia Owner', password: 'demo1234' };
// Fixed travel date inside a wide rate window, so quotes price regardless of run year.
const TRAVEL = '2026-08-15';
const RATE_FROM = '2020-01-01';
const RATE_TO = '2035-12-31';

let token = '';

async function call(method, path, body, auth = true) {
  const headers = { 'content-type': 'application/json' };
  if (auth && token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    const err = new Error(`${method} ${path} → ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const rupees = (n) => ({ amountMinor: Math.round(n * 100), currency: 'INR' });
const daysFromNow = (n) => new Date(Date.now() + n * 86400000).toISOString();

async function ensureAuth() {
  try {
    const reg = await call(
      'POST',
      '/v1/auth/register-org',
      {
        org: { name: 'Wanderlust DMC', defaultCurrency: 'INR', defaultMarkupPercent: 20 },
        owner: OWNER,
      },
      false,
    );
    token = reg.token;
    console.log('✓ Created tenant "Wanderlust DMC"');
  } catch (e) {
    if (e.status === 400 || e.status === 409) {
      const login = await call('POST', '/v1/auth/login', {
        email: OWNER.email,
        password: OWNER.password,
      }, false);
      token = login.token;
      console.log('✓ Tenant already existed — logged in');
    } else {
      throw e;
    }
  }
}

async function setStatus(enquiryId, statuses) {
  for (const status of statuses) {
    await call('POST', `/v1/enquiries/${enquiryId}/status`, { status });
  }
}

async function main() {
  console.log(`Seeding demo data into ${BASE} …`);
  await ensureAuth();

  // Team members
  for (const u of [
    { email: 'sam@demo.test', name: 'Sam Sales', role: 'Sales', password: 'demo1234' },
    { email: 'omar@demo.test', name: 'Omar Ops', role: 'Ops', password: 'demo1234' },
    { email: 'ana@demo.test', name: 'Ana Accounts', role: 'Accounts', password: 'demo1234' },
  ]) {
    try {
      await call('POST', '/v1/users', u);
    } catch (e) {
      if (e.status !== 400) throw e;
    }
  }
  console.log('✓ Team members');

  // Messaging: enable email via the logging provider
  await call('PUT', '/v1/notifications/channels', {
    channels: [
      { channel: 'email', enabled: true, provider: 'logging', from: 'ops@wanderlust.example' },
      { channel: 'sms', enabled: true, provider: 'twilio', from: '+15550100' },
      { channel: 'whatsapp', enabled: false, provider: 'gupshup', from: 'Wanderlust' },
    ],
  });
  console.log('✓ Messaging channels');

  // Suppliers
  const sup = {};
  const suppliers = [
    ['taj', { name: 'Taj Hotels & Resorts', type: 'Hotel', currency: 'INR', region: 'Goa', contact: 'reservations@taj.example' }],
    ['transfers', { name: 'Goa Premier Transfers', type: 'Transport', currency: 'INR', region: 'Goa' }],
    ['guide', { name: 'Heritage Walks India', type: 'Guide', currency: 'INR' }],
    ['adventure', { name: 'Adventure Sports Goa', type: 'Event', currency: 'INR' }],
    ['spice', { name: 'Sahakari Spice Farm', type: 'Ticket', currency: 'INR' }],
  ];
  for (const [key, input] of suppliers) {
    sup[key] = (await call('POST', '/v1/suppliers', input)).id;
  }
  console.log(`✓ ${suppliers.length} suppliers`);

  // Components + rates
  async function component(input, netRupees) {
    const c = await call('POST', '/v1/components', input);
    await call('POST', `/v1/components/${c.id}/rates`, {
      net: rupees(netRupees),
      validFrom: RATE_FROM,
      validTo: RATE_TO,
      season: 'All-year',
    });
    return c.id;
  }
  const comp = {
    transfer: await component({ type: 'Transport', supplierId: sup.transfers, name: 'Private Airport Transfer', unitBasis: 'per_pax' }, 1500),
    guide: await component({ type: 'Guide', supplierId: sup.guide, name: 'Old Goa Heritage Tour', unitBasis: 'per_pax' }, 2000),
    water: await component({ type: 'Event', supplierId: sup.adventure, name: 'Watersports Adventure Package', unitBasis: 'per_pax' }, 3500),
    spice: await component({ type: 'Ticket', supplierId: sup.spice, name: 'Spice Plantation Tour + Lunch', unitBasis: 'per_pax' }, 2500),
    breakfast: await component({ type: 'Meal', supplierId: sup.taj, name: 'Daily Breakfast', unitBasis: 'per_pax' }, 1200),
  };
  // Catalog richness: a per-night hotel rate (not quoted, to keep pricing clean)
  await component({ type: 'Hotel', supplierId: sup.taj, name: 'Taj Deluxe Sea-View (per night)', unitBasis: 'per_night' }, 9000);
  console.log('✓ Components + rate cards');

  const line = (componentId, inclusion = 'included') => ({ componentId, travelDate: TRAVEL, inclusion });
  const quoteLines = [
    line(comp.transfer),
    line(comp.guide),
    line(comp.breakfast),
    line(comp.spice),
    line(comp.water, 'optional'),
  ];

  async function buildItinerary(enquiryId, title, days) {
    const it = await call('POST', '/v1/itineraries', { enquiryId, title });
    for (const d of days) {
      await call('POST', `/v1/itineraries/${it.id}/days`, {
        dayNumber: d.dayNumber,
        date: d.date,
        headline: d.headline,
      });
      for (const s of d.segments) {
        await call('POST', `/v1/itineraries/${it.id}/days/${d.dayNumber}/segments`, s);
      }
    }
    return it.id;
  }

  const goaDays = [
    { dayNumber: 1, date: '2026-08-15', headline: 'Arrival in Goa', segments: [
      { type: 'Transfer', description: 'Airport pickup — private car', startTime: '13:00', endTime: '14:00', supplier: 'Goa Premier Transfers', bookingStatus: 'Confirmed' },
      { type: 'CheckIn', description: 'Check-in at Taj Resort', startTime: '15:00', bookingStatus: 'Confirmed' },
      { type: 'Meal', description: 'Welcome dinner by the beach', startTime: '20:00', bookingStatus: 'Pending' },
    ] },
    { dayNumber: 2, date: '2026-08-16', headline: 'Old Goa & Heritage', segments: [
      { type: 'Sightseeing', description: 'Old Goa churches & heritage walk', startTime: '09:00', endTime: '13:00', supplier: 'Heritage Walks India', bookingStatus: 'Confirmed' },
      { type: 'FreeTime', description: 'Leisure & beach time', startTime: '15:00', bookingStatus: 'TM' },
    ] },
    { dayNumber: 3, date: '2026-08-17', headline: 'Adventure & Spice', segments: [
      { type: 'Excursion', description: 'Watersports at Calangute', startTime: '09:00', endTime: '12:00', supplier: 'Adventure Sports Goa', bookingStatus: 'Pending' },
      { type: 'Excursion', description: 'Spice plantation tour + lunch', startTime: '13:00', endTime: '16:00', supplier: 'Sahakari Spice Farm', bookingStatus: 'Confirmed' },
    ] },
    { dayNumber: 4, date: '2026-08-18', headline: 'Departure', segments: [
      { type: 'Transfer', description: 'Airport drop-off', startTime: '11:00', supplier: 'Goa Premier Transfers', bookingStatus: 'Confirmed' },
    ] },
  ];

  // --- Enquiries across the pipeline ---
  async function enquiry(input) {
    return call('POST', '/v1/enquiries', input);
  }

  // E1 — Goa Family → WON (full flow, fully confirmed)
  const e1 = await enquiry({
    agencyId: 'MakeMyTrip', destinations: ['Goa'],
    pax: { adults: 4, children: [{ age: 8 }, { age: 5 }], infants: 0 },
    mealPreference: 'Breakfast included', hotelCategory: '5-star',
    specialRequirements: 'Sea-view rooms preferred; one connecting room.',
    quoteDeadline: daysFromNow(10),
  });
  await buildItinerary(e1.id, 'Goa Family Holiday — 4N / 5D', goaDays);
  await setStatus(e1.id, ['In Progress', 'Quoted']);
  const q1 = await call('POST', '/v1/quotes', { enquiryId: e1.id, lines: quoteLines });
  await call('POST', `/v1/quotes/${q1.id}/send`);
  const b1 = await call('POST', `/v1/quotes/${q1.id}/accept`);
  for (const item of b1.items) {
    await call('POST', `/v1/bookings/${b1.id}/items/${item.id}/confirm`, {
      confirmationRef: `TAJ-${item.id.slice(-5).toUpperCase()}`,
    });
  }
  console.log('✓ E1 Goa Family — Won + Confirmed booking');

  // E2 — Kerala Backwaters → QUOTED
  const e2 = await enquiry({
    agencyId: 'Yatra', destinations: ['Kerala', 'Alleppey'],
    pax: { adults: 2, children: [], infants: 0 },
    mealPreference: 'Full board', specialRequirements: 'Houseboat stay, honeymoon couple.',
    quoteDeadline: daysFromNow(6),
  });
  await buildItinerary(e2.id, 'Kerala Backwaters — 3N / 4D', [
    { dayNumber: 1, date: '2026-08-15', headline: 'Cochin arrival', segments: [
      { type: 'Transfer', description: 'Airport to hotel', startTime: '12:00', bookingStatus: 'Pending' },
      { type: 'Sightseeing', description: 'Fort Kochi & Chinese fishing nets', startTime: '16:00', bookingStatus: 'Pending' } ] },
    { dayNumber: 2, date: '2026-08-16', headline: 'Alleppey houseboat', segments: [
      { type: 'Cruise', description: 'Overnight houseboat on the backwaters', startTime: '12:00', bookingStatus: 'Pending' } ] },
  ]);
  await setStatus(e2.id, ['In Progress', 'Quoted']);
  const q2 = await call('POST', '/v1/quotes', { enquiryId: e2.id, lines: [line(comp.transfer), line(comp.guide)] });
  await call('POST', `/v1/quotes/${q2.id}/send`);
  console.log('✓ E2 Kerala — Quoted');

  // E3 — Rajasthan → IN PROGRESS (itinerary, no quote yet)
  const e3 = await enquiry({
    agencyId: 'Thomas Cook', destinations: ['Jaipur', 'Udaipur', 'Jodhpur'],
    pax: { adults: 6, children: [], infants: 0 },
    hotelCategory: 'Heritage palaces', specialRequirements: 'Palace hotels, private guide throughout.',
    quoteDeadline: daysFromNow(14),
  });
  await buildItinerary(e3.id, 'Rajasthan Heritage — 6N / 7D', [
    { dayNumber: 1, date: '2026-09-01', headline: 'Jaipur — the Pink City', segments: [
      { type: 'Sightseeing', description: 'Amber Fort & City Palace', startTime: '09:00', endTime: '14:00', bookingStatus: 'Pending' } ] },
  ]);
  await setStatus(e3.id, ['In Progress']);
  console.log('✓ E3 Rajasthan — In Progress');

  // E4 — Himalayan Adventure → NEW
  await enquiry({
    agencyId: 'Cleartrip', destinations: ['Manali', 'Leh'],
    pax: { adults: 3, children: [], infants: 0 },
    specialRequirements: 'High-altitude trek; needs acclimatisation days.',
    quoteDeadline: daysFromNow(20),
  });
  console.log('✓ E4 Himalayan — New');

  // E5 — Andaman → LOST
  const e5 = await enquiry({
    agencyId: 'MakeMyTrip', destinations: ['Port Blair', 'Havelock'],
    pax: { adults: 2, children: [], infants: 0 },
    quoteDeadline: daysFromNow(2),
  });
  await setStatus(e5.id, ['Lost']);
  console.log('✓ E5 Andaman — Lost');

  // E6 — Golden Triangle → WON (booking still confirming)
  const e6 = await enquiry({
    agencyId: 'Expedia', destinations: ['Delhi', 'Agra', 'Jaipur'],
    pax: { adults: 2, children: [{ age: 10 }], infants: 0 },
    mealPreference: 'Breakfast', quoteDeadline: daysFromNow(8),
  });
  await setStatus(e6.id, ['In Progress', 'Quoted']);
  const q6 = await call('POST', '/v1/quotes', { enquiryId: e6.id, lines: [line(comp.transfer), line(comp.guide), line(comp.breakfast)] });
  await call('POST', `/v1/quotes/${q6.id}/send`);
  const b6 = await call('POST', `/v1/quotes/${q6.id}/accept`);
  if (b6.items[0]) {
    await call('POST', `/v1/bookings/${b6.id}/items/${b6.items[0].id}/confirm`, { confirmationRef: 'EXP-90001' });
  }
  console.log('✓ E6 Golden Triangle — Won (booking confirming)');

  console.log('\n✅ Demo data seeded. Sign in:');
  console.log('   URL:      ' + BASE);
  console.log('   Owner:    owner@demo.test / demo1234');
  console.log('   Sales:    sam@demo.test / demo1234');
}

main().catch((e) => {
  console.error('\nSeed failed:', e.message);
  process.exit(1);
});
