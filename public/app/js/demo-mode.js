/* Alex Road Service — Demo mode (isolated sandbox, resets on each sign-in) */
window.ARS = window.ARS || {};

ARS.Demo = {
  EMAIL: 'demo@alexroadservice.com',
  PASSWORD: 'Demo2026!',
  STORE_KEY: 'ars_platform_demo_v1',

  isCredential(email, password) {
    return String(email || '').trim().toLowerCase() === this.EMAIL
      && String(password || '') === this.PASSWORD;
  },

  resetAndSeed() {
    this._state = this.buildSeedState();
    try {
      localStorage.setItem(ARS.DEMO_STORE_KEY || this.STORE_KEY, JSON.stringify(this._state));
    } catch { /* localStorage unavailable */ }
    ARS.markDemoSession?.();
    return this._state;
  },

  getState() {
    if (this._state?.customers?.length) return this._state;
    const key = ARS.DEMO_STORE_KEY || this.STORE_KEY;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.customers?.length) {
          this._state = parsed;
          return this._state;
        }
      }
    } catch { /* ignore */ }
    return this.resetAndSeed();
  },

  setState(state) {
    this._state = state;
    try {
      localStorage.setItem(ARS.DEMO_STORE_KEY || this.STORE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  },

  ensureSeeded() {
    const state = this.getState();
    return !!(state?.customers?.length);
  },

  /** Fresh dataset — call only on demo sign-in */
  seedForLogin() {
    return this.resetAndSeed();
  },

  clearSession() {
    this._state = null;
    try {
      localStorage.removeItem(ARS.DEMO_STORE_KEY || this.STORE_KEY);
    } catch { /* ignore */ }
  },

  buildSeedState() {
    const year = new Date().getFullYear();
    const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();
    const fmt = (daysAgo) => {
      const d = new Date(Date.now() - daysAgo * 86400000);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const taxRate = 0.06625;
    const TAX = taxRate;

    const money = (labor, parts, taxExempt = false) => {
      const tax = taxExempt ? 0 : Math.round(parts * TAX * 100) / 100;
      const total = Math.round((labor + parts + tax) * 100) / 100;
      return { labor, parts, tax, total };
    };

    const woId = (n) => `WO-${year}-${String(n).padStart(4, '0')}`;
    const estId = (n) => `EST-${year}-${String(n).padStart(4, '0')}`;
    const invId = (n) => `INV-${year}-${String(n).padStart(4, '0')}`;
    const payId = (n) => `PAY-${year}-${String(n).padStart(4, '0')}`;

    const customers = [
      { id: 'C101', name: 'James Reid', company: 'Reid Trucking LLC', phone: '(732) 555-0101', email: 'jreid@reidtrucking.demo', type: 'Fleet', trucks: 3, status: 'Active', notes: 'Preferred fleet — NET 14. PO required on orders over $2,500.', spentAmount: 12480.5, version: 1, createdAt: iso(420) },
      { id: 'C102', name: 'Maria Lopez', company: 'Lopez Distribution', phone: '(732) 555-0102', email: 'maria@lopezdistribution.demo', type: 'Fleet', trucks: 3, status: 'Active', notes: 'Runs regional dry van fleet.', spentAmount: 8920, version: 1, createdAt: iso(380) },
      { id: 'C103', name: 'David Kim', company: 'Kim Brothers Transport', phone: '(732) 555-0103', email: 'david@kimbrothers.demo', type: 'Owner-Op', trucks: 1, status: 'Active', notes: 'Single owner-operator unit.', spentAmount: 3240, version: 1, createdAt: iso(300) },
      { id: 'C104', name: 'Tom Bradley', company: 'Metro Freight Lines', phone: '(732) 555-0104', email: 'tom@metrofreight.demo', type: 'Fleet', trucks: 4, status: 'Active', notes: 'National account — priority scheduling.', spentAmount: 15650, version: 1, createdAt: iso(260) },
      { id: 'C105', name: 'Lisa Chen', company: 'Coastal Logistics', phone: '(732) 555-0105', email: 'lisa@coastallogistics.demo', type: 'Fleet', trucks: 2, status: 'Inactive', notes: 'Account on hold pending insurance update.', spentAmount: 980, version: 1, createdAt: iso(500) },
      { id: 'C106', name: 'Vincent Russo', company: 'Russo Concrete', phone: '(732) 555-0106', email: 'vrusso@russoconcrete.demo', type: 'Fleet', trucks: 5, status: 'Active', notes: 'Mixer and heavy haul units.', spentAmount: 22100, version: 1, createdAt: iso(200) },
      { id: 'C107', name: 'Patricia Webb', company: 'Webb Refrigerated', phone: '(732) 555-0107', email: 'pwebb@webbrefrig.demo', type: 'Fleet', trucks: 3, status: 'Active', notes: 'Reefer PM every 90 days.', spentAmount: 6740, version: 1, createdAt: iso(180) },
      { id: 'C108', name: 'Carlos Mendez', company: '—', phone: '(732) 555-0108', email: 'carlos.mendez.demo@gmail.com', type: 'Owner-Op', trucks: 1, status: 'Active', notes: 'Independent O/O — pays at time of service.', spentAmount: 1850, version: 1, createdAt: iso(90) },
      { id: 'C109', name: 'Susan Hale', company: 'Hale & Sons Moving', phone: '(732) 555-0109', email: 'shale@halesons.demo', type: 'Fleet', trucks: 2, status: 'Active', notes: '', spentAmount: 4120, version: 1, createdAt: iso(120) },
      { id: 'C110', name: 'Gregory Nash', company: 'Nash Intermodal', phone: '(732) 555-0110', email: 'gnash@nashintermodal.demo', type: 'Fleet', trucks: 6, status: 'Active', notes: 'Port drayage fleet.', spentAmount: 18900, version: 1, createdAt: iso(150) },
    ];

    const trucks = [
      { id: 'T101', unit: '101', year: 2021, make: 'Freightliner', model: 'Cascadia', vin: '1FUJGHDV8MLDA1234', customerId: 'C101', mileage: '342,500', lastPM: fmt(60), nextPM: fmt(-5), status: 'PM Due', version: 1, createdAt: iso(420) },
      { id: 'T102', unit: '102', year: 2019, make: 'Kenworth', model: 'T680', vin: '1XKYDP9X5KJ123456', customerId: 'C101', mileage: '518,200', lastPM: fmt(30), nextPM: fmt(150), status: 'Active', version: 1, createdAt: iso(420) },
      { id: 'T103', unit: '103', year: 2020, make: 'Peterbilt', model: '389', vin: '1XPWD40X5LD789012', customerId: 'C101', mileage: '445,800', lastPM: fmt(45), nextPM: fmt(135), status: 'Active', version: 1, createdAt: iso(400) },
      { id: 'T104', unit: '201', year: 2020, make: 'Volvo', model: 'VNL 760', vin: '4V4NC9EH5LN123456', customerId: 'C102', mileage: '401,800', lastPM: fmt(45), nextPM: fmt(135), status: 'Active', version: 1, createdAt: iso(380) },
      { id: 'T105', unit: '202', year: 2018, make: 'Freightliner', model: 'M2 106', vin: '3ALACWFC1JDJ45678', customerId: 'C102', mileage: '287,400', lastPM: fmt(20), nextPM: fmt(160), status: 'Active', version: 1, createdAt: iso(360) },
      { id: 'T106', unit: '301', year: 2018, make: 'Peterbilt', model: '579', vin: '1XPWD40X1JD123456', customerId: 'C103', mileage: '612,400', lastPM: fmt(20), nextPM: fmt(160), status: 'Active', version: 1, createdAt: iso(300) },
      { id: 'T107', unit: '401', year: 2022, make: 'International', model: 'LT', vin: '3HSDZAPR5NN123456', customerId: 'C104', mileage: '198,300', lastPM: fmt(15), nextPM: fmt(165), status: 'Active', version: 1, createdAt: iso(260) },
      { id: 'T108', unit: '402', year: 2017, make: 'Mack', model: 'Anthem', vin: '1M1AN07Y5HM123456', customerId: 'C104', mileage: '721,000', lastPM: fmt(10), nextPM: fmt(170), status: 'Active', version: 1, createdAt: iso(260) },
      { id: 'T109', unit: '501', year: 2019, make: 'Kenworth', model: 'W990', vin: '1NKWL49X9KJ654321', customerId: 'C106', mileage: '334,200', lastPM: fmt(25), nextPM: fmt(-2), status: 'PM Due', version: 1, createdAt: iso(200) },
      { id: 'T110', unit: '601', year: 2021, make: 'Utility', model: 'Reefer Trailer', vin: '1UYVS2531MM112233', customerId: 'C107', mileage: '—', lastPM: fmt(40), nextPM: fmt(50), status: 'Active', version: 1, createdAt: iso(180) },
      { id: 'T111', unit: '701', year: 2016, make: 'Freightliner', model: 'Columbia', vin: '1FUJA6CV86LN99887', customerId: 'C108', mileage: '892,100', lastPM: fmt(55), nextPM: fmt(125), status: 'Active', version: 1, createdAt: iso(90) },
      { id: 'T112', unit: '801', year: 2023, make: 'Isuzu', model: 'NPR-HD', vin: 'JALC4W1637D445566', customerId: 'C109', mileage: '45,600', lastPM: fmt(12), nextPM: fmt(168), status: 'Active', version: 1, createdAt: iso(120) },
      { id: 'T113', unit: '901', year: 2020, make: 'Volvo', model: 'VNR 300', vin: '4V4NC9TJ5LN778899', customerId: 'C110', mileage: '256,700', lastPM: fmt(18), nextPM: fmt(162), status: 'In Shop', version: 1, createdAt: iso(150) },
      { id: 'T114', unit: '902', year: 2019, make: 'Hino', model: '268', vin: '5PVNJ8JN7K4S33445', customerId: 'C110', mileage: '178,900', lastPM: fmt(8), nextPM: fmt(172), status: 'Active', version: 1, createdAt: iso(140) },
    ];

    const m = money;
    const workOrders = [
      { id: woId(1), date: fmt(1), customerId: 'C101', customerName: 'Reid Trucking LLC', truckId: 'T101', truckLabel: 'Unit 101 · Freightliner Cascadia', tech: 'Mike Santos', serviceType: 'PM Service', status: 'Open', desc: 'Scheduled PM — oil, filters, grease, DOT prep', ...m(285, 420), invoiced: false, version: 1, createdAt: iso(1) },
      { id: woId(2), date: fmt(3), customerId: 'C102', customerName: 'Lopez Distribution', truckId: 'T104', truckLabel: 'Unit 201 · Volvo VNL 760', tech: 'Alex Rodriguez', serviceType: 'Brake Service', status: 'In Progress', desc: 'Replace steer axle brake pads and drums', ...m(520, 890), invoiced: false, lineItems: [{ partId: 'P102', qty: 2, desc: 'Brake Pad Set' }], version: 1, createdAt: iso(3) },
      { id: woId(3), date: fmt(6), customerId: 'C103', customerName: 'Kim Brothers Transport', truckId: 'T106', truckLabel: 'Unit 301 · Peterbilt 579', tech: 'Mike Santos', serviceType: 'Engine Repair', status: 'Waiting Parts', desc: 'Turbocharger replacement — awaiting P103 delivery', ...m(640, 1240), invoiced: false, version: 1, createdAt: iso(6) },
      { id: woId(4), date: fmt(10), customerId: 'C101', customerName: 'Reid Trucking LLC', truckId: 'T102', truckLabel: 'Unit 102 · Kenworth T680', tech: 'Sarah Torres', serviceType: 'DOT Inspection', status: 'Completed', desc: 'Annual DOT inspection — passed all points', ...m(195, 85), invoiced: false, version: 1, createdAt: iso(10) },
      { id: woId(5), date: fmt(14), customerId: 'C102', customerName: 'Lopez Distribution', truckId: 'T104', truckLabel: 'Unit 201 · Volvo VNL 760', tech: 'Alex Rodriguez', serviceType: 'Tire Service', status: 'Invoiced', desc: 'Replace 4 drive tires — 295/75R22.5', ...m(310, 680), invoiced: true, version: 1, createdAt: iso(14) },
      { id: woId(6), date: fmt(2), customerId: 'C104', customerName: 'Metro Freight Lines', truckId: 'T107', truckLabel: 'Unit 401 · International LT', tech: 'Sarah Torres', serviceType: 'Electrical', status: 'Completed', desc: 'Diagnose and repair trailer light circuit', ...m(445, 320), invoiced: false, version: 1, createdAt: iso(2) },
      { id: woId(7), date: fmt(22), customerId: 'C106', customerName: 'Russo Concrete', truckId: 'T109', truckLabel: 'Unit 501 · Kenworth W990', tech: 'Mike Santos', serviceType: 'Transmission', status: 'Invoiced', desc: 'Transmission fluid service and filter', ...m(380, 540), invoiced: true, version: 1, createdAt: iso(22) },
      { id: woId(8), date: fmt(35), customerId: 'C107', customerName: 'Webb Refrigerated', truckId: 'T110', truckLabel: 'Unit 601 · Utility Reefer Trailer', tech: 'Alex Rodriguez', serviceType: 'Other', status: 'Completed', desc: 'Reefer unit compressor repair', ...m(720, 1580), invoiced: false, version: 1, createdAt: iso(35) },
      { id: woId(9), date: fmt(45), customerId: 'C110', customerName: 'Nash Intermodal', truckId: 'T113', truckLabel: 'Unit 901 · Volvo VNR 300', tech: 'Sarah Torres', serviceType: 'Body / Frame', status: 'Invoiced', desc: 'Landing gear replacement and frame weld', ...m(890, 2100), invoiced: true, version: 1, createdAt: iso(45) },
      { id: woId(10), date: fmt(55), customerId: 'C104', customerName: 'Metro Freight Lines', truckId: 'T108', truckLabel: 'Unit 402 · Mack Anthem', tech: 'Mike Santos', serviceType: 'Engine Repair', status: 'Completed', desc: 'EGR valve cleaning and coolant flush', ...m(560, 780), invoiced: false, version: 1, createdAt: iso(55) },
      { id: woId(11), date: fmt(68), customerId: 'C101', customerName: 'Reid Trucking LLC', truckId: 'T103', truckLabel: 'Unit 103 · Peterbilt 389', tech: 'Alex Rodriguez', serviceType: 'PM Service', status: 'Invoiced', desc: 'Quarterly PM service', ...m(275, 395), invoiced: true, version: 1, createdAt: iso(68) },
      { id: woId(12), date: fmt(82), customerId: 'C109', customerName: 'Hale & Sons Moving', truckId: 'T112', truckLabel: 'Unit 801 · Isuzu NPR-HD', tech: 'Sarah Torres', serviceType: 'Brake Service', status: 'Completed', desc: 'Rear brake adjustment and air line repair', ...m(340, 290), invoiced: false, version: 1, createdAt: iso(82) },
      { id: woId(13), date: fmt(95), customerId: 'C108', customerName: 'Carlos Mendez', truckId: 'T111', truckLabel: 'Unit 701 · Freightliner Columbia', tech: 'Mike Santos', serviceType: 'Tire Service', status: 'Invoiced', desc: 'Steer tire replacement (2)', ...m(180, 855), invoiced: true, version: 1, createdAt: iso(95) },
      { id: woId(14), date: fmt(110), customerId: 'C106', customerName: 'Russo Concrete', truckId: 'T109', truckLabel: 'Unit 501 · Kenworth W990', tech: 'Alex Rodriguez', serviceType: 'DOT Inspection', status: 'Completed', desc: 'DOT annual — mixer unit', ...m(210, 120), invoiced: false, version: 1, createdAt: iso(110) },
    ];

    const estimates = [
      { id: estId(1), date: fmt(4), customerName: 'Coastal Logistics', customerId: 'C105', truckLabel: 'Unit 501 · Mack Anthem', desc: 'Transmission rebuild estimate', ...m(380, 920), status: 'Sent', version: 1, createdAt: iso(4) },
      { id: estId(2), date: fmt(1), customerName: 'Reid Trucking LLC', customerId: 'C101', truckLabel: 'Unit 101 · Freightliner Cascadia', desc: 'Coolant system repair — radiator and hoses', ...m(220, 340), status: 'Pending', version: 1, createdAt: iso(1) },
      { id: estId(3), date: fmt(7), customerName: 'Kim Brothers Transport', customerId: 'C103', truckLabel: 'Unit 301 · Peterbilt 579', desc: 'Turbo replacement (customer approved)', ...m(640, 1180), status: 'Approved', version: 1, createdAt: iso(7) },
      { id: estId(4), date: fmt(15), customerName: 'Nash Intermodal', customerId: 'C110', truckLabel: 'Unit 902 · Hino 268', desc: 'Full engine overhaul quote', ...m(4200, 8900), status: 'Declined', version: 1, createdAt: iso(15) },
      { id: estId(5), date: fmt(28), customerName: 'Webb Refrigerated', customerId: 'C107', truckLabel: 'Unit 601 · Utility Reefer', desc: 'Reefer compressor — converted to WO-0008', ...m(720, 1580), status: 'Converted', workOrderId: woId(8), version: 1, createdAt: iso(28) },
      { id: estId(6), date: fmt(2), customerName: 'Metro Freight Lines', customerId: 'C104', truckLabel: 'Unit 401 · International LT', desc: 'Electrical diagnostics (same as WO-0006)', ...m(445, 320), status: 'Approved', version: 1, createdAt: iso(2) },
      { id: estId(7), date: fmt(20), customerName: 'Russo Concrete', customerId: 'C106', truckLabel: 'Unit 501 · Kenworth W990', desc: 'Hydraulic pump replacement on mixer', ...m(980, 2240), status: 'Sent', version: 1, createdAt: iso(20) },
      { id: estId(8), date: fmt(0), customerName: 'Hale & Sons Moving', customerId: 'C109', truckLabel: 'Unit 801 · Isuzu NPR-HD', desc: 'Box truck liftgate repair', ...m(310, 480), status: 'Pending', version: 1, createdAt: iso(0) },
    ];

    const inv5Total = m(310, 680).total;
    const inv7Total = m(380, 540).total;
    const inv9Total = m(890, 2100).total;
    const inv11Total = m(275, 395).total;
    const inv13Total = m(180, 855).total;
    const inv6Total = m(445, 320).total;

    const invoices = [
      { id: invId(1), date: fmt(12), due: fmt(-2), customerName: 'Lopez Distribution', customerId: 'C102', workOrderId: woId(5), total: inv5Total, amountPaid: inv5Total, status: 'Paid', version: 1, createdAt: iso(12) },
      { id: invId(2), date: fmt(40), due: fmt(26), customerName: 'Metro Freight Lines', customerId: 'C104', workOrderId: '', total: 1875.5, amountPaid: 875, status: 'Partially Paid', version: 1, createdAt: iso(40) },
      { id: invId(3), date: fmt(18), due: fmt(4), customerName: 'Reid Trucking LLC', customerId: 'C101', workOrderId: '', total: 1240.75, amountPaid: 1240.75, status: 'Paid', version: 1, createdAt: iso(18) },
      { id: invId(4), date: fmt(1), due: fmt(13), customerName: 'Metro Freight Lines', customerId: 'C104', workOrderId: woId(6), total: inv6Total, amountPaid: 400, status: 'Partially Paid', version: 1, createdAt: iso(1) },
      { id: invId(5), date: fmt(20), due: fmt(6), customerName: 'Russo Concrete', customerId: 'C106', workOrderId: woId(7), total: inv7Total, amountPaid: inv7Total, status: 'Paid', version: 1, createdAt: iso(20) },
      { id: invId(6), date: fmt(33), due: fmt(19), customerName: 'Webb Refrigerated', customerId: 'C107', workOrderId: woId(8), total: m(720, 1580).total, amountPaid: 1000, status: 'Partially Paid', version: 1, createdAt: iso(33) },
      { id: invId(7), date: fmt(43), due: fmt(29), customerName: 'Nash Intermodal', customerId: 'C110', workOrderId: woId(9), total: inv9Total, amountPaid: inv9Total, status: 'Paid', version: 1, createdAt: iso(43) },
      { id: invId(8), date: fmt(65), due: fmt(51), customerName: 'Reid Trucking LLC', customerId: 'C101', workOrderId: woId(11), total: inv11Total, amountPaid: inv11Total, status: 'Paid', version: 1, createdAt: iso(65) },
      { id: invId(9), date: fmt(92), due: fmt(78), customerName: 'Carlos Mendez', customerId: 'C108', workOrderId: woId(13), total: inv13Total, amountPaid: inv13Total, status: 'Paid', version: 1, createdAt: iso(92) },
      { id: invId(10), date: fmt(50), due: fmt(36), customerName: 'Coastal Logistics', customerId: 'C105', workOrderId: '', total: 450, amountPaid: 0, status: 'Written Off', writeOffReason: 'Customer closed account — goodwill write-off', version: 1, createdAt: iso(50) },
    ];

    const payments = [
      { id: payId(1), date: fmt(10), customerName: 'Lopez Distribution', invoiceId: invId(1), amount: inv5Total, method: 'Stripe', status: 'Completed', stripeSessionId: 'demo_cs_001', createdAt: iso(10) },
      { id: payId(2), date: fmt(16), customerName: 'Reid Trucking LLC', invoiceId: invId(3), amount: 500, method: 'Stripe', status: 'Completed', stripeSessionId: 'demo_cs_002', createdAt: iso(16) },
      { id: payId(3), date: fmt(18), customerName: 'Russo Concrete', invoiceId: invId(5), amount: inv7Total, method: 'Stripe', status: 'Completed', stripeSessionId: 'demo_cs_003', createdAt: iso(18) },
      { id: payId(4), date: fmt(35), customerName: 'Webb Refrigerated', invoiceId: invId(6), amount: 1000, method: 'Stripe', status: 'Completed', stripeSessionId: 'demo_cs_004', createdAt: iso(35) },
      { id: payId(5), date: fmt(41), customerName: 'Nash Intermodal', invoiceId: invId(7), amount: inv9Total, method: 'Stripe', status: 'Completed', stripeSessionId: 'demo_cs_005', createdAt: iso(41) },
      { id: payId(6), date: fmt(63), customerName: 'Reid Trucking LLC', invoiceId: invId(8), amount: inv11Total, method: 'Stripe', status: 'Completed', stripeSessionId: 'demo_cs_006', createdAt: iso(63) },
      { id: payId(7), date: fmt(90), customerName: 'Carlos Mendez', invoiceId: invId(9), amount: inv13Total, method: 'Stripe', status: 'Completed', stripeSessionId: 'demo_cs_007', createdAt: iso(90) },
      { id: payId(8), date: fmt(120), customerName: 'Metro Freight Lines', invoiceId: invId(4), amount: 400, method: 'Stripe', status: 'Completed', stripeSessionId: 'demo_cs_008', createdAt: iso(120) },
      { id: payId(9), date: fmt(150), customerName: 'Metro Freight Lines', invoiceId: invId(2), amount: 875, method: 'Stripe', status: 'Completed', stripeSessionId: 'demo_cs_009', createdAt: iso(150) },
      { id: payId(10), date: fmt(175), customerName: 'Reid Trucking LLC', invoiceId: invId(3), amount: 740.75, method: 'Stripe', status: 'Completed', stripeSessionId: 'demo_cs_010', createdAt: iso(175) },
    ];

    const inventory = [
      { id: 'P101', partNo: 'LF-9009', desc: 'Oil Filter — Cummins ISX', cat: 'Filters', qty: 24, min: 10, cost: 12.5, price: 18.75, status: 'In Stock', version: 1, createdAt: iso(400) },
      { id: 'P102', partNo: 'BP-7845', desc: 'Brake Pad Set — Steer Axle', cat: 'Brakes', qty: 4, min: 6, cost: 89, price: 133.5, status: 'Low', version: 1, createdAt: iso(400) },
      { id: 'P103', partNo: 'TB-4420', desc: 'Turbocharger — Peterbilt 579', cat: 'Engine', qty: 0, min: 1, cost: 1850, price: 2775, status: 'Out of Stock', version: 1, createdAt: iso(400) },
      { id: 'P104', partNo: 'AF-3301', desc: 'Air Filter — Freightliner', cat: 'Filters', qty: 18, min: 8, cost: 42, price: 63, status: 'In Stock', version: 1, createdAt: iso(400) },
      { id: 'P105', partNo: 'DL-1150', desc: 'Drive Tire 295/75R22.5', cat: 'Tires', qty: 8, min: 4, cost: 285, price: 427.5, status: 'In Stock', version: 1, createdAt: iso(400) },
      { id: 'P106', partNo: 'CL-2200', desc: 'Coolant — Extended Life 50/50', cat: 'Fluids', qty: 2, min: 6, cost: 18, price: 27, status: 'Low', version: 1, createdAt: iso(400) },
      { id: 'P107', partNo: 'DF-5500', desc: 'Fuel Filter — Fleetguard', cat: 'Filters', qty: 32, min: 12, cost: 22, price: 33, status: 'In Stock', version: 1, createdAt: iso(400) },
      { id: 'P108', partNo: 'WB-3300', desc: 'Wiper Blade 24"', cat: 'Other', qty: 15, min: 6, cost: 14, price: 21, status: 'In Stock', version: 1, createdAt: iso(400) },
      { id: 'P109', partNo: 'AL-8800', desc: 'Alternator — Delco Remy 160A', cat: 'Electrical', qty: 3, min: 2, cost: 245, price: 367.5, status: 'In Stock', version: 1, createdAt: iso(400) },
      { id: 'P110', partNo: 'ST-7700', desc: 'Starter Motor — Cummins ISX', cat: 'Electrical', qty: 1, min: 2, cost: 380, price: 570, status: 'Low', version: 1, createdAt: iso(400) },
      { id: 'P111', partNo: 'HD-4400', desc: 'DEF Fluid — 2.5 Gal', cat: 'Fluids', qty: 0, min: 4, cost: 12, price: 18, status: 'Out of Stock', version: 1, createdAt: iso(400) },
      { id: 'P112', partNo: 'SP-2201', desc: 'Shock Absorber — Steer', cat: 'Other', qty: 6, min: 4, cost: 78, price: 117, status: 'In Stock', version: 1, createdAt: iso(400) },
      { id: 'P113', partNo: 'CLT-9900', desc: 'Clutch Kit — Eaton Fuller', cat: 'Transmission', qty: 2, min: 1, cost: 890, price: 1335, status: 'In Stock', version: 1, createdAt: iso(400) },
      { id: 'P114', partNo: 'LG-1100', desc: 'Landing Gear Leg — Trailer', cat: 'Other', qty: 1, min: 2, cost: 420, price: 630, status: 'Low', version: 1, createdAt: iso(400) },
    ];

    const inventoryTransactions = [
      { id: 'tx_001', partId: 'P102', delta: -2, reason: `workOrder:${woId(2)}`, at: iso(3) },
      { id: 'tx_002', partId: 'P105', delta: -4, reason: `workOrder:${woId(5)}`, at: iso(14) },
      { id: 'tx_003', partId: 'P103', delta: -1, reason: `workOrder:${woId(3)}`, at: iso(8) },
      { id: 'tx_004', partId: 'P101', delta: 12, reason: 'restock', at: iso(30) },
      { id: 'tx_005', partId: 'P106', delta: -4, reason: `workOrder:${woId(10)}`, at: iso(55) },
      { id: 'tx_006', partId: 'P111', delta: -4, reason: 'restock oversight', at: iso(20) },
      { id: 'tx_007', partId: 'P107', delta: 20, reason: 'restock', at: iso(45) },
      { id: 'tx_008', partId: 'P114', delta: -1, reason: `workOrder:${woId(9)}`, at: iso(45) },
    ];

    const contactSubmissions = [
      { id: 'lead_001', name: 'Robert Walsh', company: 'Walsh Hauling', email: 'rwalsh@walshhaul.demo', phone: '(732) 555-0201', service: 'Emergency Roadside', truck: '2020 Volvo VNL', location: 'I-95 Exit 9, NJ', message: 'Need roadside assistance for overheating — stranded on shoulder.', timestamp: iso(0), source: 'website-contact-form', createdAt: iso(0) },
      { id: 'lead_002', name: 'Angela Ruiz', company: 'Ruiz Cartage', email: 'angela@ruizcartage.demo', phone: '(732) 555-0202', service: 'PM Service', truck: 'Fleet of 6 units', location: 'Keasbey, NJ', message: 'Looking for fleet PM pricing and schedule availability.', timestamp: iso(1), source: 'website-contact-form', createdAt: iso(1) },
      { id: 'lead_003', name: 'Frank DiMarco', company: 'DiMarco Express', email: 'fdimarco@dimarco.demo', phone: '(732) 555-0203', service: 'DOT Inspection', truck: '3 tractors', location: 'Perth Amboy, NJ', message: 'Need DOT inspections scheduled for March.', timestamp: iso(2), source: 'website-contact-form', createdAt: iso(2) },
      { id: 'lead_004', name: 'Nina Patel', company: 'Patel Logistics', email: 'npatel@patellog.demo', phone: '(732) 555-0204', service: 'Brake Service', truck: '2019 Kenworth T680', location: 'Edison, NJ', message: 'Grinding noise from steer axle — need estimate.', timestamp: iso(4), source: 'website-contact-form', createdAt: iso(4) },
      { id: 'lead_005', name: 'Howard Greene', company: 'Greene Waste Services', email: 'hgreene@greenewaste.demo', phone: '(732) 555-0205', service: 'Other', truck: 'Roll-off fleet', location: 'Woodbridge, NJ', message: 'Hydraulic cylinder leak on roll-off truck.', timestamp: iso(6), source: 'website-contact-form', createdAt: iso(6) },
    ];

    const auditLog = [
      { id: 'audit_001', action: 'demo.seed', entityType: 'system', at: iso(0), by: this.EMAIL },
      { id: 'audit_002', action: 'workOrder.create', entityId: woId(1), entityType: 'workOrder', at: iso(1), by: this.EMAIL },
      { id: 'audit_003', action: 'invoice.create', entityId: invId(4), entityType: 'invoice', at: iso(1), by: this.EMAIL },
      { id: 'audit_004', action: 'payment.stripe', entityId: payId(1), entityType: 'payment', invoiceId: invId(1), amount: inv5Total, at: iso(10), by: 'demo_stripe' },
      { id: 'audit_005', action: 'customer.create', entityId: 'C110', entityType: 'customer', at: iso(150), by: this.EMAIL },
      { id: 'audit_006', action: 'inventory.adjust', entityId: 'P102', entityType: 'inventory', at: iso(3), by: this.EMAIL },
    ];

    return {
      isDemoDataset: true,
      customers,
      trucks,
      workOrders,
      estimates,
      invoices,
      payments,
      inventory,
      inventoryTransactions,
      notifications: [],
      contactSubmissions,
      auditLog,
      settings: {
        laborRate: 95,
        partsMarkup: 0.4,
        taxRate,
        paymentTermsDays: 14,
        shopName: 'Alex Road Service (Demo)',
        shopAddress: '406 Smith St, Keasbey, NJ 08832',
        shopPhone: '(732) 938-0713',
        shopEmail: 'info@alexroadservice.com',
      },
      counters: {
        wo: 14, est: 8, inv: 10, pay: 10, cust: 110, truck: 114, part: 114,
        [`wo_${year}`]: 14,
        [`est_${year}`]: 8,
        [`inv_${year}`]: 10,
        [`pay_${year}`]: 10,
      },
      seeded: true,
      demoPurged: true,
      demoPurgeSkipped: true,
    };
  },
};

if (typeof ARS.isDemoMode === 'function' && ARS.isDemoMode()) {
  ARS.Demo.getState();
}
