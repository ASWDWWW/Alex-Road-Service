/* =====================================================
   ALEX ROAD SERVICE — Mock Data
   ===================================================== */

const CUSTOMERS = [
  { id:'C001', name:'Marcus Reid',     company:'Reid Trucking LLC',  phone:'(732) 555-0182', email:'mreid@reidtrucking.com',    type:'Fleet',    trucks:3, lastService:'Mar 3, 2026',  spent:'$4,820', status:'Active'   },
  { id:'C002', name:'Sandra Lopez',    company:'Lopez Distribution', phone:'(908) 555-0241', email:'slopez@lopezmails.com',     type:'Fleet',    trucks:5, lastService:'Mar 1, 2026',  spent:'$2,145', status:'Active'   },
  { id:'C003', name:'Derek James',     company:'James Construction', phone:'(732) 555-0397', email:'djames@jamesconstruct.com', type:'Fleet',    trucks:4, lastService:'Feb 15, 2026', spent:'$6,380', status:'Active'   },
  { id:'C004', name:'Travis Cooper',   company:'—',                  phone:'(201) 555-0128', email:'tcooper@email.com',         type:'Owner-Op', trucks:1, lastService:'Mar 3, 2026',  spent:'$890',  status:'Active'   },
  { id:'C005', name:'Linda Gomez',     company:'—',                  phone:'(732) 555-0074', email:'lgomez@email.com',          type:'Owner-Op', trucks:1, lastService:'Feb 20, 2026', spent:'$320',  status:'Active'   },
  { id:'C006', name:'Paul Washington', company:'WashEx Logistics',   phone:'(973) 555-0319', email:'paul@washex.com',           type:'Fleet',    trucks:7, lastService:'Jan 30, 2026', spent:'$9,120', status:'Active'   },
  { id:'C007', name:'Nadia Kim',       company:'Kim Brothers Inc.',  phone:'(732) 555-0445', email:'nadia@kimbrothers.com',     type:'Fleet',    trucks:2, lastService:'Mar 5, 2026',  spent:'$1,650', status:'Active'   },
  { id:'C008', name:'Robert Mills',    company:'Mills Hauling',      phone:'(201) 555-0088', email:'robert@millshauling.com',   type:'Owner-Op', trucks:1, lastService:'Feb 10, 2026', spent:'$450',  status:'Inactive' },
];

const TRUCKS = [
  { id:'T001', unit:'101', year:2019, make:'Freightliner', model:'Cascadia',   vin:'1FUJGHD...GE0001', customer:'C002', owner:'Lopez Distribution', mileage:'387,420', lastPM:'Nov 15, 2025', nextPM:'May 15, 2026', status:'Active'   },
  { id:'T002', unit:'205', year:2021, make:'Kenworth',     model:'T680',       vin:'1XKFDE0...J123456', customer:'C001', owner:'Reid Trucking LLC',  mileage:'214,180', lastPM:'Dec 10, 2025', nextPM:'Jun 10, 2026', status:'In Shop'  },
  { id:'T003', unit:'310', year:2018, make:'Peterbilt',    model:'579',        vin:'1XPWD49...D654321', customer:'C003', owner:'James Construction', mileage:'501,900', lastPM:'Oct 22, 2025', nextPM:'Apr 22, 2026', status:'Active'   },
  { id:'T004', unit:'007', year:2020, make:'International',model:'LT Series',  vin:'3HSDXAP...N987654', customer:'C004', owner:'Travis Cooper',      mileage:'163,400', lastPM:'Jan 8, 2026',  nextPM:'Jul 8, 2026',  status:'Active'   },
  { id:'T005', unit:'414', year:2017, make:'Volvo',        model:'VNL 760',    vin:'4V4NC9E...N112233', customer:'C006', owner:'WashEx Logistics',   mileage:'698,220', lastPM:'Sep 30, 2025', nextPM:'Mar 30, 2026', status:'PM Due'   },
  { id:'T006', unit:'512', year:2022, make:'Mack',         model:'Anthem',     vin:'1M1AN4G...M445566', customer:'C003', owner:'James Construction', mileage:'88,750',  lastPM:'Feb 1, 2026',  nextPM:'Aug 1, 2026',  status:'Active'   },
  { id:'T007', unit:'088', year:2016, make:'Freightliner', model:'Columbia',   vin:'1FUJEEV...SBR7788', customer:'C007', owner:'Kim Brothers Inc.',  mileage:'832,400', lastPM:'Nov 5, 2025',  nextPM:'May 5, 2026',  status:'Active'   },
  { id:'T008', unit:'333', year:2023, make:'Kenworth',     model:'W990',       vin:'1XKFD49...J889900', customer:'C006', owner:'WashEx Logistics',   mileage:'44,200',  lastPM:'Feb 20, 2026', nextPM:'Aug 20, 2026', status:'Active'   },
  { id:'T009', unit:'601', year:2019, make:'Western Star', model:'5700XE',     vin:'5KJJBRL...GA1010',  customer:'C005', owner:'Linda Gomez',        mileage:'290,100', lastPM:'Jan 15, 2026', nextPM:'Jul 15, 2026', status:'Active'   },
  { id:'T010', unit:'777', year:2020, make:'Peterbilt',    model:'389',        vin:'1XPFD49...D112121', customer:'C008', owner:'Mills Hauling',       mileage:'445,600', lastPM:'Aug 20, 2025', nextPM:'Feb 20, 2026', status:'PM Due'   },
];

const WORK_ORDERS = [
  { id:'WO-2026-0012', date:'Mar 6, 2026',  customer:'Reid Trucking LLC',  truck:'Unit 205 · Kenworth T680',       tech:'Mike Santos', status:'In Progress',  desc:'Air brake chamber replacement + system inspection', labor:320, parts:185, total:505   },
  { id:'WO-2026-0011', date:'Mar 5, 2026',  customer:'Nadia Kim',          truck:'Unit 088 · Freightliner Columbia',tech:'Jose Rivera', status:'Completed',    desc:'Fuel filter replacement + system prime',             labor:160, parts:95,  total:255   },
  { id:'WO-2026-0010', date:'Mar 4, 2026',  customer:'Derek James',        truck:'Unit 310 · Peterbilt 579',        tech:'Mike Santos', status:'Waiting Parts',desc:'Alternator replacement — part on order',             labor:240, parts:380, total:620   },
  { id:'WO-2026-0009', date:'Mar 3, 2026',  customer:'Travis Cooper',      truck:'Unit 007 · International LT',     tech:'Tom Ellis',   status:'Open',         desc:'No-start diagnostic + battery replacement',         labor:120, parts:210, total:330   },
  { id:'WO-2026-0008', date:'Mar 1, 2026',  customer:'Lopez Distribution', truck:'Unit 101 · Freightliner Cascadia',tech:'Jose Rivera', status:'Invoiced',     desc:'Preventive maintenance — oil, filters, lube',       labor:280, parts:140, total:420   },
  { id:'WO-2026-0007', date:'Feb 28, 2026', customer:'WashEx Logistics',   truck:'Unit 414 · Volvo VNL 760',        tech:'Mike Santos', status:'Completed',    desc:'Radiator coolant leak repair',                      labor:400, parts:220, total:620   },
  { id:'WO-2026-0006', date:'Feb 27, 2026', customer:'James Construction', truck:'Unit 512 · Mack Anthem',          tech:'Tom Ellis',   status:'Invoiced',     desc:'Air compressor replacement',                        labor:360, parts:480, total:840   },
  { id:'WO-2026-0005', date:'Feb 25, 2026', customer:'Linda Gomez',        truck:'Unit 601 · Western Star 5700XE',  tech:'Jose Rivera', status:'Completed',    desc:'Jump start + battery test',                         labor:80,  parts:0,   total:80    },
  { id:'WO-2026-0004', date:'Feb 22, 2026', customer:'WashEx Logistics',   truck:'Unit 333 · Kenworth W990',        tech:'Mike Santos', status:'Completed',    desc:'Brake adjustment + S-cam inspection',               labor:200, parts:65,  total:265   },
  { id:'WO-2026-0003', date:'Feb 20, 2026', customer:'Reid Trucking LLC',  truck:'Unit 205 · Kenworth T680',        tech:'Tom Ellis',   status:'Completed',    desc:'Clutch adjustment + road test',                     labor:160, parts:0,   total:160   },
];

const ESTIMATES = [
  { id:'EST-2026-006', date:'Mar 5, 2026',  customer:'WashEx Logistics',  truck:'Unit 414 · Volvo VNL 760',        desc:'Complete PM + air dryer replacement',     labor:320, parts:280, total:600,  status:'Pending'  },
  { id:'EST-2026-005', date:'Mar 4, 2026',  customer:'Derek James',       truck:'Unit 310 · Peterbilt 579',        desc:'Engine diagnostic + injector service',    labor:480, parts:620, total:1100, status:'Approved' },
  { id:'EST-2026-004', date:'Mar 2, 2026',  customer:'Kim Brothers Inc.', truck:'Unit 088 · Freightliner Columbia',desc:'Brake reline + drum replacement',          labor:560, parts:420, total:980,  status:'Pending'  },
  { id:'EST-2026-003', date:'Feb 28, 2026', customer:'Travis Cooper',     truck:'Unit 007 · International LT',     desc:'Transmission fluid service + clutch adj.',labor:200, parts:150, total:350,  status:'Approved' },
  { id:'EST-2026-002', date:'Feb 25, 2026', customer:'Robert Mills',      truck:'Unit 777 · Peterbilt 389',        desc:'Turbo inspection + intercooler clean',    labor:280, parts:0,   total:280,  status:'Declined' },
  { id:'EST-2026-001', date:'Feb 20, 2026', customer:'Lopez Distribution',truck:'Unit 101 · Freightliner Cascadia',desc:'DOT inspection + brake compliance',        labor:240, parts:180, total:420,  status:'Approved' },
];

const INVOICES = [
  { id:'INV-2026-010', date:'Mar 5, 2026',  due:'Mar 19, 2026', customer:'Nadia Kim',          wo:'WO-2026-0011', total:'$255.00',   status:'Sent'    },
  { id:'INV-2026-009', date:'Mar 1, 2026',  due:'Mar 15, 2026', customer:'Lopez Distribution', wo:'WO-2026-0008', total:'$420.00',   status:'Sent'    },
  { id:'INV-2026-008', date:'Feb 28, 2026', due:'Mar 13, 2026', customer:'WashEx Logistics',   wo:'WO-2026-0007', total:'$620.00',   status:'Paid'    },
  { id:'INV-2026-007', date:'Feb 27, 2026', due:'Mar 12, 2026', customer:'James Construction', wo:'WO-2026-0006', total:'$840.00',   status:'Paid'    },
  { id:'INV-2026-006', date:'Feb 25, 2026', due:'Mar 10, 2026', customer:'Linda Gomez',        wo:'WO-2026-0005', total:'$80.00',    status:'Paid'    },
  { id:'INV-2026-005', date:'Feb 22, 2026', due:'Mar 8, 2026',  customer:'WashEx Logistics',   wo:'WO-2026-0004', total:'$265.00',   status:'Paid'    },
  { id:'INV-2026-004', date:'Feb 20, 2026', due:'Mar 5, 2026',  customer:'Reid Trucking LLC',  wo:'WO-2026-0003', total:'$160.00',   status:'Overdue' },
  { id:'INV-2026-003', date:'Feb 15, 2026', due:'Mar 1, 2026',  customer:'James Construction', wo:'WO-2026-0002', total:'$1,250.00', status:'Overdue' },
];

const PAYMENTS = [
  { id:'PAY-2026-006', date:'Mar 4, 2026',  customer:'WashEx Logistics',  invoice:'INV-2026-008', amount:'$620.00', method:'Card',  status:'Completed' },
  { id:'PAY-2026-005', date:'Mar 2, 2026',  customer:'James Construction',invoice:'INV-2026-007', amount:'$840.00', method:'Check', status:'Completed' },
  { id:'PAY-2026-004', date:'Mar 1, 2026',  customer:'Linda Gomez',       invoice:'INV-2026-006', amount:'$80.00',  method:'Cash',  status:'Completed' },
  { id:'PAY-2026-003', date:'Feb 28, 2026', customer:'WashEx Logistics',  invoice:'INV-2026-005', amount:'$265.00', method:'Card',  status:'Completed' },
  { id:'PAY-2026-002', date:'Feb 22, 2026', customer:'Reid Trucking LLC', invoice:'INV-2026-002', amount:'$505.00', method:'Card',  status:'Completed' },
  { id:'PAY-2026-001', date:'Feb 20, 2026', customer:'Kim Brothers Inc.', invoice:'INV-2026-001', amount:'$410.00', method:'Check', status:'Completed' },
];

const INVENTORY = [
  { id:'P001', partNo:'AIR-BC-1650', desc:'Brake Chamber Type 30',         cat:'Brakes',     qty:4,  min:3,  cost:42.00,  price:78.00,  status:'In Stock'    },
  { id:'P002', partNo:'AIR-DR-2210', desc:'Air Dryer Cartridge — Std',     cat:'Air System', qty:2,  min:2,  cost:28.00,  price:52.00,  status:'Low'         },
  { id:'P003', partNo:'ELEC-ALT-77', desc:'Alternator 160A Universal',     cat:'Electrical', qty:1,  min:2,  cost:185.00, price:340.00, status:'Low'         },
  { id:'P004', partNo:'ELEC-STR-33', desc:'Starter Motor 12V',             cat:'Electrical', qty:2,  min:2,  cost:95.00,  price:195.00, status:'Low'         },
  { id:'P005', partNo:'BAT-6D-24',   desc:'Battery 6D Commercial 24V',     cat:'Electrical', qty:5,  min:2,  cost:120.00, price:220.00, status:'In Stock'    },
  { id:'P006', partNo:'FUEL-FF-88',  desc:'Fuel Filter Primary FF5018',    cat:'Fuel',       qty:8,  min:4,  cost:18.00,  price:35.00,  status:'In Stock'    },
  { id:'P007', partNo:'FUEL-DEF-5G', desc:'DEF Fluid — 5 Gallon',         cat:'Fuel',       qty:3,  min:4,  cost:22.00,  price:42.00,  status:'Low'         },
  { id:'P008', partNo:'HYD-HS-38',   desc:'Hydraulic Hose 3/8" (per ft)', cat:'Hydraulic',  qty:45, min:20, cost:4.50,   price:9.00,   status:'In Stock'    },
  { id:'P009', partNo:'HYD-FIT-M',   desc:'Hydraulic Fitting Male JIC',   cat:'Hydraulic',  qty:28, min:10, cost:3.20,   price:6.50,   status:'In Stock'    },
  { id:'P010', partNo:'COOL-AF-1G',  desc:'Coolant/Antifreeze — 1 Gal',   cat:'Cooling',    qty:12, min:6,  cost:14.00,  price:26.00,  status:'In Stock'    },
  { id:'P011', partNo:'OIL-15W40',   desc:'Engine Oil 15W-40 — 1 Qt',     cat:'Fluids',     qty:24, min:12, cost:7.50,   price:14.00,  status:'In Stock'    },
  { id:'P012', partNo:'OIL-FLT-HD',  desc:'Oil Filter Heavy Duty',        cat:'Fluids',     qty:10, min:6,  cost:12.00,  price:22.00,  status:'In Stock'    },
  { id:'P013', partNo:'AIR-LINE-12', desc:'Air Line Tubing 1/2" (per ft)',cat:'Air System', qty:0,  min:10, cost:1.80,   price:3.50,   status:'Out of Stock'},
  { id:'P014', partNo:'GLH-AIR-HH',  desc:'Gladhand — Air Hose Hand',     cat:'Air System', qty:6,  min:4,  cost:14.00,  price:26.00,  status:'In Stock'    },
  { id:'P015', partNo:'BRAKE-SH-10', desc:'Brake Shoe Set — Axle Set',    cat:'Brakes',     qty:3,  min:2,  cost:85.00,  price:155.00, status:'In Stock'    },
];

const TECHS = ['Mike Santos', 'Jose Rivera', 'Tom Ellis'];
const SERVICE_TYPES = [
  'Air Brake Repair','Brake Adjustment','Air System Repair','Air Dryer Service',
  'Electrical Repair','Starter Replacement','Alternator Replacement',
  'Fuel Filter Service','DEF System Service','Fuel Delivery',
  'Hydraulic Hose Repair','Hydraulic System Service',
  'Jump Start','Battery Replacement','Radiator Repair',
  'Preventive Maintenance','DOT Inspection','Clutch Adjustment',
  'Engine Diagnostic','Tire Change','Other',
];
