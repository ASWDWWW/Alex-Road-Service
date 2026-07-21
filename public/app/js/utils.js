/* Alex Road Service — Shared Utilities */
window.ARS = window.ARS || {};
ARS.APP_BUILD = '20260721d';

ARS.fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

ARS.parseMoney = (s) => {
  if (typeof s === 'number') return s;
  return parseFloat(String(s).replace(/[$,]/g, '')) || 0;
};

ARS.fmtDate = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return String(d || '');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

ARS.toInputDate = (d = new Date()) => {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
};

ARS.initials = (name) => {
  if (!name) return '??';
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
};

ARS.uid = () => 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

ARS.nextId = (prefix, year, num) => `${prefix}-${year}-${String(num).padStart(4, '0')}`;

ARS.escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

ARS.inventoryStatus = (qty, min) => {
  if (qty <= 0) return 'Out of Stock';
  if (qty < min) return 'Low';
  return 'In Stock';
};

ARS.calcTotals = (labor, parts, settings = {}) => {
  const laborNum = Number(labor) || 0;
  const partsNum = Number(parts) || 0;
  const taxRate = settings.taxRate ?? 0.06625;
  const taxExempt = settings.taxExempt ?? false;
  const tax = taxExempt ? 0 : partsNum * taxRate;
  return { labor: laborNum, parts: partsNum, tax, total: laborNum + partsNum + tax };
};

ARS.DEMO_SESSION_KEY = 'ars_demo_session';
ARS.DEMO_STORE_KEY = 'ars_platform_demo_v1';

ARS.isDemoMode = () => {
  try {
    if (sessionStorage.getItem(ARS.DEMO_SESSION_KEY) === '1') return true;
    if (localStorage.getItem(ARS.DEMO_SESSION_KEY) === '1') return true;
    if (new URLSearchParams(window.location.search).get('demo') === '1') return true;
    const cached = sessionStorage.getItem('ars_session') || localStorage.getItem('ars_session');
    if (cached && JSON.parse(cached).role === 'demo') return true;
  } catch { /* ignore */ }
  return ARS.Auth?.getUser?.()?.role === 'demo';
};

ARS.markDemoSession = () => {
  try {
    sessionStorage.setItem(ARS.DEMO_SESSION_KEY, '1');
    localStorage.setItem(ARS.DEMO_SESSION_KEY, '1');
  } catch { /* ignore */ }
};

ARS.clearDemoSession = () => {
  try {
    sessionStorage.removeItem(ARS.DEMO_SESSION_KEY);
    localStorage.removeItem(ARS.DEMO_SESSION_KEY);
  } catch { /* ignore */ }
  ARS.Demo?.clearSession?.();
};

ARS.can = (action) => {
  const role = ARS.Auth?.getRole?.();
  if (role === 'developer' || role === 'demo') return true;
  const matrix = ARS.PERMISSIONS || {};
  const allowed = matrix[action];
  if (!allowed) return true;
  return allowed.includes(role);
};

ARS.PERMISSIONS = {
  'customers.create': ['admin', 'office'],
  'customers.edit': ['admin', 'office'],
  'customers.deactivate': ['admin'],
  'trucks.create': ['admin', 'office'],
  'trucks.edit': ['admin', 'office'],
  'workOrders.create': ['admin', 'office'],
  'workOrders.editAll': ['admin', 'office'],
  'workOrders.assign': ['admin', 'office'],
  'workOrders.invoice': ['admin', 'office'],
  'estimates.create': ['admin', 'office'],
  'estimates.send': ['admin', 'office'],
  'invoices.create': ['admin', 'office'],
  'invoices.edit': ['admin', 'office'],
  'invoices.writeOff': ['admin'],
  'payments.record': ['admin', 'office'],
  'payments.refund': ['admin', 'developer'],
  'inventory.edit': ['admin', 'office'],
  'reports.view': ['admin', 'office'],
  'settings.view': ['admin', 'developer'],
  'settings.edit': ['admin', 'developer'],
  'users.manage': ['admin', 'developer'],
  'employees.view': ['admin', 'office', 'developer'],
  'employees.manage': ['admin', 'developer'],
  'messages.view': ['admin', 'office', 'technician', 'developer'],
  'messages.send': ['admin', 'office', 'technician', 'developer'],
  'schedule.view': ['admin', 'office', 'technician', 'developer'],
  'schedule.manage': ['admin', 'office', 'developer'],
};

ARS.ROLE_LABELS = {
  admin: 'Administrator',
  office: 'Office Staff',
  technician: 'Technician',
  developer: 'Developer',
  demo: 'Demo Mode',
};

ARS.NAV_BY_ROLE = {
  admin: null,
  office: null,
  developer: null,
  technician: ['/app/dashboard.html', '/app/customers.html', '/app/trucks.html', '/app/work-orders.html', '/app/inventory.html', '/app/messages.html', '/app/schedule.html'],
};

ARS.canAccessLeads = () => ['admin', 'office', 'developer', 'demo'].includes(ARS.Auth?.getRole?.() || '');

ARS.SERVICE_TYPES = [
  'PM Service', 'DOT Inspection', 'Brake Service', 'Engine Repair',
  'Transmission', 'Electrical', 'Tire Service', 'Body / Frame', 'Other',
];

ARS.exportCSV = (filename, headers, rows) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};
