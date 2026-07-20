const fs = require('fs');
const path = require('path');

const TAX = 0.06625;
const money = (labor, parts) => {
  const tax = Math.round(parts * TAX * 100) / 100;
  const total = Math.round((labor + parts + tax) * 100) / 100;
  return { labor, parts, tax, total };
};
const line = (partId, desc, qty, unitPrice) => ({ partId, desc, qty, unitPrice });

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

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: 'NULL_VALUE' };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toValue(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function toDoc(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toValue(v);
  return { fields };
}

const out = jobs.map((j) => ({
  woId: j.woId,
  invId: j.invId,
  total: j.total,
  wo: toDoc({
    id: j.woId,
    date: j.date,
    customerId: j.customerId,
    customerName: j.customerName,
    truckLabel: j.truckLabel,
    tech: j.tech,
    serviceType: j.serviceType,
    status: 'Invoiced',
    desc: j.desc,
    labor: j.labor,
    parts: j.parts,
    tax: j.tax,
    total: j.total,
    invoiced: true,
    lineItems: j.lineItems,
    version: 1,
    createdAt: '2026-07-20T14:50:00.000Z',
  }),
  inv: toDoc({
    id: j.invId,
    date: j.date,
    due: j.due,
    customerId: j.customerId,
    customerName: j.customerName,
    workOrderId: j.woId,
    total: j.total,
    amountPaid: 0,
    status: 'Sent',
    version: 1,
    createdAt: '2026-07-20T14:50:00.000Z',
  }),
}));

const stripeWo = toDoc({
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
});

const outPath = path.join(__dirname, '_seed-payloads.json');
fs.writeFileSync(outPath, JSON.stringify({ jobs: out, stripeWo }));
console.log('wrote', outPath, 'jobs=', out.length);
