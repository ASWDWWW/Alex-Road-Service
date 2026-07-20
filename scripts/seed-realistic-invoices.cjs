/**
 * One-off seed: realistic customers, work orders (with parts), unpaid invoices.
 * Run from repo root:
 *   node --experimental-default-type=module scripts/seed-realistic-invoices.mjs
 * Or:
 *   cd functions && node ../scripts/seed-realistic-invoices.cjs
 */
const path = require('path');
process.env.NODE_PATH = path.join(__dirname, '..', 'functions', 'node_modules');
require('module').Module._initPaths();

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'launchpage-alex-roadservice',
  });
}
const db = admin.firestore();
const TAX = 0.06625;

function money(labor, parts) {
  const tax = Math.round(parts * TAX * 100) / 100;
  const total = Math.round((labor + parts + tax) * 100) / 100;
  return { labor, parts, tax, total };
}

function line(partId, desc, qty, unitPrice) {
  return { partId, desc, qty, unitPrice };
}

const customers = [
  { id: 'C101', name: 'James Reid', company: 'Reid Trucking LLC', phone: '(732) 555-0101', email: 'jreid@reidtrucking.example', type: 'Fleet', trucks: 3, status: 'Active', notes: 'Preferred fleet — NET 14.', version: 1 },
  { id: 'C102', name: 'Maria Lopez', company: 'Lopez Distribution', phone: '(732) 555-0102', email: 'maria@lopezdistribution.example', type: 'Fleet', trucks: 3, status: 'Active', notes: 'Regional dry van fleet.', version: 1 },
  { id: 'C104', name: 'Tom Bradley', company: 'Metro Freight Lines', phone: '(732) 555-0104', email: 'tom@metrofreight.example', type: 'Fleet', trucks: 4, status: 'Active', notes: 'National account — priority scheduling.', version: 1 },
  { id: 'C106', name: 'Vincent Russo', company: 'Russo Concrete', phone: '(732) 555-0106', email: 'vrusso@russoconcrete.example', type: 'Fleet', trucks: 5, status: 'Active', notes: 'Mixer and heavy haul units.', version: 1 },
  { id: 'C107', name: 'Patricia Webb', company: 'Webb Refrigerated', phone: '(732) 555-0107', email: 'pwebb@webbrefrig.example', type: 'Fleet', trucks: 3, status: 'Active', notes: 'Reefer PM every 90 days.', version: 1 },
  { id: 'C109', name: 'Susan Hale', company: 'Hale & Sons Moving', phone: '(732) 555-0109', email: 'shale@halesons.example', type: 'Fleet', trucks: 2, status: 'Active', notes: '', version: 1 },
  { id: 'C110', name: 'Gregory Nash', company: 'Nash Intermodal', phone: '(732) 555-0110', email: 'gnash@nashintermodal.example', type: 'Fleet', trucks: 6, status: 'Active', notes: 'Port drayage fleet.', version: 1 },
];

const jobs = [
  {
    woId: 'WO-2026-0101', invId: 'INV-2026-0101', customerId: 'C101', customerName: 'Reid Trucking LLC',
    truckLabel: 'Unit 101 · Freightliner Cascadia', tech: 'Mike Santos', serviceType: 'Brake Service',
    desc: 'Replace steer axle brake pads and drums; road test and air system check',
    date: 'Jul 14, 2026', due: 'Jul 28, 2026',
    lineItems: [
      line('P-BRK-PAD', 'Steer brake pad set', 2, 145),
      line('P-BRK-DRM', 'Brake drum 15"', 2, 210),
      line('P-BRK-HDW', 'Brake hardware kit', 1, 180),
    ],
    ...money(520, 890),
  },
  {
    woId: 'WO-2026-0102', invId: 'INV-2026-0102', customerId: 'C102', customerName: 'Lopez Distribution',
    truckLabel: 'Unit 201 · Volvo VNL 760', tech: 'Alex Rodriguez', serviceType: 'Tire Service',
    desc: 'Replace 4 drive tires 295/75R22.5; torque and alignment check',
    date: 'Jul 15, 2026', due: 'Jul 29, 2026',
    lineItems: [
      line('P-TIR-295', 'Drive tire 295/75R22.5', 4, 155),
      line('P-TIR-VAL', 'Valve stems / TPMS service', 4, 15),
    ],
    ...money(310, 680),
  },
  {
    woId: 'WO-2026-0103', invId: 'INV-2026-0103', customerId: 'C104', customerName: 'Metro Freight Lines',
    truckLabel: 'Unit 401 · International LT', tech: 'Sarah Torres', serviceType: 'Electrical',
    desc: 'Diagnose and repair trailer light circuit; replace damaged harness section',
    date: 'Jul 16, 2026', due: 'Jul 30, 2026',
    lineItems: [
      line('P-ELC-HAR', 'Trailer wiring harness section', 1, 185),
      line('P-ELC-CON', 'Weatherpack connectors', 1, 55),
      line('P-ELC-LED', 'LED marker / stop lamps', 4, 20),
    ],
    ...money(445, 320),
  },
  {
    woId: 'WO-2026-0104', invId: 'INV-2026-0104', customerId: 'C106', customerName: 'Russo Concrete',
    truckLabel: 'Unit 501 · Kenworth W990', tech: 'Mike Santos', serviceType: 'Hydraulics',
    desc: 'Onsite hydraulic hose failure on mixer — fabricate hose, replace fittings, refill fluid',
    date: 'Jul 17, 2026', due: 'Jul 31, 2026',
    lineItems: [
      line('P-HYD-HOS', 'Custom hydraulic hose assembly', 1, 320),
      line('P-HYD-FIT', 'JIC fittings / adapters', 1, 120),
      line('P-HYD-FLD', 'Hydraulic fluid (gal)', 2, 50),
    ],
    ...money(380, 540),
  },
  {
    woId: 'WO-2026-0105', invId: 'INV-2026-0105', customerId: 'C107', customerName: 'Webb Refrigerated',
    truckLabel: 'Unit 601 · Utility Reefer Trailer', tech: 'Alex Rodriguez', serviceType: 'Reefer Repair',
    desc: 'Reefer unit compressor replacement; evacuate, recharge, and verify setpoints',
    date: 'Jul 18, 2026', due: 'Aug 1, 2026',
    lineItems: [
      line('P-REF-CMP', 'Reefer compressor assembly', 1, 1180),
      line('P-REF-DRY', 'Receiver drier', 1, 160),
      line('P-REF-REF', 'Refrigerant / oil charge', 1, 240),
    ],
    ...money(720, 1580),
  },
  {
    woId: 'WO-2026-0106', invId: 'INV-2026-0106', customerId: 'C109', customerName: 'Hale & Sons Moving',
    truckLabel: 'Unit 801 · Isuzu NPR-HD', tech: 'Sarah Torres', serviceType: 'Brake Service',
    desc: 'Rear brake adjustment, air line repair, and chamber inspection',
    date: 'Jul 18, 2026', due: 'Aug 1, 2026',
    lineItems: [
      line('P-AIR-LN', 'Air brake line / fittings', 1, 95),
      line('P-BRK-SH', 'Brake shoes (pair)', 1, 145),
      line('P-AIR-CH', 'Slack adjuster hardware', 1, 50),
    ],
    ...money(340, 290),
  },
  {
    woId: 'WO-2026-0107', invId: 'INV-2026-0107', customerId: 'C110', customerName: 'Nash Intermodal',
    truckLabel: 'Unit 901 · Volvo VNR 300', tech: 'Sarah Torres', serviceType: 'Body / Frame',
    desc: 'Landing gear replacement and frame weld reinforcement at kingpin area',
    date: 'Jul 19, 2026', due: 'Aug 2, 2026',
    lineItems: [
      line('P-LG-ASM', 'Landing gear assembly (set)', 1, 1450),
      line('P-LG-BRK', 'Landing gear braces / hardware', 1, 350),
      line('P-WLD-MAT', 'Welding consumables / plate', 1, 300),
    ],
    ...money(890, 2100),
  },
  {
    woId: 'WO-2026-0108', invId: 'INV-2026-0108', customerId: 'C101', customerName: 'Reid Trucking LLC',
    truckLabel: 'Unit 102 · Kenworth T680', tech: 'Mike Santos', serviceType: 'PM Service',
    desc: 'Scheduled PM — engine oil, filters, grease chassis, DOT prep inspection',
    date: 'Jul 19, 2026', due: 'Aug 2, 2026',
    lineItems: [
      line('P-PM-OIL', 'CK-4 15W-40 engine oil (gal)', 10, 22),
      line('P-PM-OF', 'Oil filter', 1, 38),
      line('P-PM-AF', 'Air filter', 1, 65),
      line('P-PM-FF', 'Fuel filter', 1, 48),
      line('P-PM-CAB', 'Cabin filter', 1, 49),
    ],
    ...money(285, 420),
  },
];

async function upsert(collection, id, data) {
  await db.collection(collection).doc(id).set({ ...data, id, createdAt: data.createdAt || new Date().toISOString() }, { merge: true });
}

async function main() {
  for (const c of customers) {
    await upsert('customers', c.id, c);
    console.log('customer', c.id, c.company);
  }

  for (const job of jobs) {
    const {
      woId, invId, customerId, customerName, truckLabel, tech, serviceType, desc,
      date, due, lineItems, labor, parts, tax, total,
    } = job;

    await upsert('workOrders', woId, {
      date, customerId, customerName, truckLabel, tech, serviceType,
      status: 'Invoiced', desc, labor, parts, tax, total,
      invoiced: true, lineItems, version: 1,
    });

    await upsert('invoices', invId, {
      date, due, customerId, customerName, workOrderId: woId,
      total, amountPaid: 0, status: 'Sent', version: 1,
    });

    console.log('invoice', invId, customerName, `$${total}`, '—', serviceType);
  }

  await db.collection('workOrders').doc('WO-2026-0100').set({
    lineItems: [
      line('P-BRK-PAD', 'Steer brake pad set', 2, 55),
      line('P-BRK-ROT', 'Brake rotor / drum service kit', 1, 40),
    ],
    labor: 190,
    parts: 150,
    tax: 9.94,
    total: 349.94,
    serviceType: 'Brake Service',
    desc: 'Test brake job for Stripe payment UAT — pads and hardware',
    tech: 'Alex Rodriguez',
    truckLabel: 'Unit 99 · Test Truck',
  }, { merge: true });
  console.log('updated WO-2026-0100 with parts detail');
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
