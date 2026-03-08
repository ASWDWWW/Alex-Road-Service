/* =====================================================
   ALEX ROAD SERVICE — Ops Platform Shared Components
   ===================================================== */

const APP_USER = { name: 'Alex Rodriguez', role: 'Administrator', initials: 'AR' };

const NAV = [
  { href: '/app/dashboard.html',   icon: 'fas fa-tachometer-alt',       label: 'Dashboard',   badge: null },
  { href: '/app/customers.html',   icon: 'fas fa-users',                 label: 'Customers',   badge: null },
  { href: '/app/trucks.html',      icon: 'fas fa-truck',                 label: 'Trucks',      badge: null },
  { href: '/app/work-orders.html', icon: 'fas fa-clipboard-list',        label: 'Work Orders', badge: '3'  },
  { href: '/app/estimates.html',   icon: 'fas fa-file-alt',              label: 'Estimates',   badge: null },
  { href: '/app/invoices.html',    icon: 'fas fa-file-invoice-dollar',   label: 'Invoices',    badge: '2'  },
  { href: '/app/payments.html',    icon: 'fas fa-credit-card',           label: 'Payments',    badge: null },
  { href: '/app/inventory.html',   icon: 'fas fa-boxes',                 label: 'Inventory',   badge: '3'  },
  { href: '/app/reports.html',     icon: 'fas fa-chart-bar',             label: 'Reports',     badge: null },
];

function isActive(href) {
  const p = window.location.pathname;
  const key = href.split('/').pop().replace('.html','');
  return p.includes(key);
}

function buildSidebar() {
  const items = NAV.map(n => `
    <a href="${n.href}" class="sidebar__item${isActive(n.href) ? ' active' : ''}">
      <i class="${n.icon}"></i>
      <span>${n.label}</span>
      ${n.badge ? `<span class="sidebar__badge">${n.badge}</span>` : ''}
    </a>`).join('');

  return `
<div class="sidebar" id="appSidebar">
  <div class="sidebar__brand">
    <div class="sidebar__brand-mark">A</div>
    <div>
      <div class="sidebar__brand-name">ALEX ROAD</div>
      <div class="sidebar__brand-sub">Operations Platform</div>
    </div>
  </div>
  <nav class="sidebar__nav">
    <div class="sidebar__section">Main Menu</div>
    ${items}
    <div class="sidebar__section" style="margin-top:8px">Other</div>
    <a href="/" class="sidebar__item" style="opacity:.65">
      <i class="fas fa-globe"></i><span>Public Website</span>
    </a>
  </nav>
  <div class="sidebar__footer">
    <div class="sidebar__user">
      <div class="sidebar__avatar">${APP_USER.initials}</div>
      <div>
        <div class="sidebar__user-name">${APP_USER.name}</div>
        <div class="sidebar__user-role">${APP_USER.role}</div>
      </div>
    </div>
    <button class="sidebar__logout" id="logoutBtn">
      <i class="fas fa-sign-out-alt"></i> Sign Out
    </button>
  </div>
</div>
<div class="sidebar-overlay" id="sidebarOverlay"></div>`;
}

function buildTopbar(title) {
  return `
<div class="topbar">
  <button class="topbar__burger btn btn--ghost btn--icon" id="sidebarToggle"><i class="fas fa-bars"></i></button>
  <div class="topbar__title">${title}</div>
  <div class="topbar__search">
    <i class="fas fa-search"></i>
    <input type="text" placeholder="Search anything…" id="globalSearch">
  </div>
  <div class="topbar__actions">
    <button class="topbar__icon-btn" id="notifsBtn">
      <i class="fas fa-bell"></i>
      <span class="topbar__notif-dot"></span>
    </button>
    <div class="topbar__user">
      <div class="topbar__user-avatar">${APP_USER.initials}</div>
      <span class="topbar__user-name">${APP_USER.name}</span>
    </div>
  </div>
</div>`;
}

/* ─── TOAST ─── */
function showToast(msg, type = 'success') {
  let el = document.getElementById('appToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'appToast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
  el.className = `toast toast--${type}`;
  el.innerHTML = `<i class="fas ${icons[type] || icons.success}"></i> ${msg}`;
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => el.classList.remove('show'), 3600);
}

/* ─── MODAL ─── */
function openModal(id)  { document.getElementById(id)?.classList.add('open');    }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

/* ─── STATUS CHIP ─── */
const CHIP_MAP = {
  'Open':          'chip--open',
  'In Progress':   'chip--inprogress',
  'Waiting Parts': 'chip--waiting',
  'Completed':     'chip--completed',
  'Invoiced':      'chip--invoiced',
  'Paid':          'chip--paid',
  'Overdue':       'chip--overdue',
  'Low':           'chip--low',
  'Out of Stock':  'chip--outofstock',
  'In Stock':      'chip--instock',
  'Active':        'chip--active',
  'Inactive':      'chip--inactive',
  'PM Due':        'chip--pmdue',
  'In Shop':       'chip--inshop',
  'Pending':       'chip--pending',
  'Approved':      'chip--approved',
  'Declined':      'chip--declined',
  'Sent':          'chip--sent',
  'Draft':         'chip--draft',
  'Fleet':         'chip--fleet',
  'Owner-Op':      'chip--ownerop',
};
function chip(status) {
  return `<span class="chip ${CHIP_MAP[status] || 'chip--open'}">${status}</span>`;
}

/* ─── CURRENCY ─── */
function fmt$(n) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', () => {
  /* Mock auth gate */
  if (!sessionStorage.getItem('appLoggedIn')) {
    window.location.href = '/login.html';
    return;
  }

  /* Inject sidebar */
  const sbEl = document.getElementById('sidebar-placeholder');
  if (sbEl) sbEl.outerHTML = buildSidebar();
  else document.body.insertAdjacentHTML('afterbegin', buildSidebar());

  /* Inject topbar */
  const tbEl = document.getElementById('topbar-placeholder');
  const title = tbEl?.dataset.title || document.title.split('|')[0].trim();
  if (tbEl) tbEl.outerHTML = buildTopbar(title);

  /* Sidebar mobile toggle */
  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.getElementById('appSidebar')?.classList.toggle('open');
    document.getElementById('sidebarOverlay')?.classList.toggle('open');
  });
  document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
    document.getElementById('appSidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('open');
  });

  /* Logout */
  document.addEventListener('click', e => {
    if (e.target.closest('#logoutBtn')) {
      sessionStorage.removeItem('appLoggedIn');
      window.location.href = '/login.html';
    }
  });

  /* Close modals on overlay click */
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
  });
  document.querySelectorAll('[data-close-modal]').forEach(b => {
    b.addEventListener('click', () => b.closest('.modal-overlay')?.classList.remove('open'));
  });

  /* Notifications bell mock */
  document.getElementById('notifsBtn')?.addEventListener('click', () => {
    showToast('3 alerts: Low inventory, 2 overdue invoices', 'warning');
  });
});
