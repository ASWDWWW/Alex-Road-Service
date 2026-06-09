/* Alex Road Service — Ops Platform Shared Components */
window.ARS = window.ARS || {};

const NAV_ITEMS = [
  { href: '/app/dashboard.html',   icon: 'fas fa-tachometer-alt',       label: 'Dashboard',   badgeKey: null, perm: null },
  { href: '/app/customers.html',   icon: 'fas fa-users',                 label: 'Customers',   badgeKey: null, perm: null },
  { href: '/app/trucks.html',      icon: 'fas fa-truck',                 label: 'Trucks',      badgeKey: null, perm: null },
  { href: '/app/work-orders.html', icon: 'fas fa-clipboard-list',        label: 'Work Orders', badgeKey: 'openWOs', perm: null },
  { href: '/app/estimates.html',   icon: 'fas fa-file-alt',              label: 'Estimates',   badgeKey: null, perm: 'estimates.create' },
  { href: '/app/invoices.html',    icon: 'fas fa-file-invoice-dollar',   label: 'Invoices',    badgeKey: 'overdueInv', perm: 'invoices.create' },
  { href: '/app/payments.html',    icon: 'fas fa-credit-card',           label: 'Payments',    badgeKey: null, perm: 'payments.record' },
  { href: '/app/inventory.html',   icon: 'fas fa-boxes',                 label: 'Inventory',   badgeKey: 'lowStock', perm: null },
  { href: '/app/reports.html',     icon: 'fas fa-chart-bar',             label: 'Reports',     badgeKey: null, perm: 'reports.view' },
  { href: '/app/settings.html',    icon: 'fas fa-cog',                   label: 'Settings',    badgeKey: null, perm: 'settings.view' },
  { href: '/app/leads.html',       icon: 'fas fa-inbox',                 label: 'Leads',       badgeKey: 'leads', perm: null },
];

function getAppUser() {
  const u = ARS.Auth?.getUser?.();
  if (!u) return { name: 'Staff', role: 'Staff', initials: 'ST' };
  return { name: u.name, role: ARS.Auth.displayRole(), initials: ARS.initials(u.name) };
}

function navAllowed(href) {
  const role = ARS.Auth?.getRole?.();
  const allowed = ARS.NAV_BY_ROLE?.[role];
  if (!allowed) return true;
  return allowed.includes(href);
}

function getBadges() {
  try {
    const kpis = ARS.Data.getDashboardKPIs();
    const openWOs = kpis.openWOs || 0;
    const overdue = ARS.Store.getCollection('invoices').filter((i) => i.status === 'Overdue').length;
    const low = kpis.lowStockCount || 0;
    const leads = ARS.Store.getCollection('contactSubmissions').length;
    return {
      openWOs: openWOs || null,
      overdueInv: overdue || null,
      lowStock: low || null,
      leads: leads || null,
    };
  } catch {
    return {};
  }
}

function isActive(href) {
  const p = window.location.pathname;
  const key = href.split('/').pop().replace('.html', '');
  return p.includes(key);
}

function buildSidebar() {
  const user = getAppUser();
  const badges = getBadges();
  const items = NAV_ITEMS.filter((n) => {
    if (!navAllowed(n.href)) return false;
    if (n.href.includes('leads') && !ARS.canAccessLeads?.()) return false;
    if (n.perm && !ARS.can(n.perm)) return false;
    return true;
  }).map((n) => {
    const badge = n.badgeKey && badges[n.badgeKey] ? badges[n.badgeKey] : null;
    return `
    <a href="${n.href}" class="sidebar__item${isActive(n.href) ? ' active' : ''}">
      <i class="${n.icon}"></i>
      <span>${n.label}</span>
      ${badge ? `<span class="sidebar__badge">${badge}</span>` : ''}
    </a>`;
  }).join('');

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
      <div class="sidebar__avatar">${user.initials}</div>
      <div>
        <div class="sidebar__user-name">${user.name}</div>
        <div class="sidebar__user-role">${user.role}</div>
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
  const user = getAppUser();
  return `
<div class="topbar">
  <button class="topbar__burger btn btn--ghost btn--icon" id="sidebarToggle"><i class="fas fa-bars"></i></button>
  <div class="topbar__title">${title}</div>
  <div class="topbar__search" style="position:relative">
    <i class="fas fa-search"></i>
    <input type="text" placeholder="Search anything…" id="globalSearch" autocomplete="off">
    <div id="searchResults" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:200;max-height:320px;overflow-y:auto;margin-top:4px"></div>
  </div>
  <div class="topbar__actions">
    <button class="topbar__icon-btn" id="notifsBtn" title="Notifications">
      <i class="fas fa-bell"></i>
      <span class="topbar__notif-dot" id="notifDot"></span>
    </button>
    <div class="topbar__user">
      <div class="topbar__user-avatar">${user.initials}</div>
      <span class="topbar__user-name">${user.name}</span>
    </div>
  </div>
</div>`;
}

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

function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

const CHIP_MAP = {
  'Open': 'chip--open', 'In Progress': 'chip--inprogress', 'Waiting Parts': 'chip--waiting',
  'Completed': 'chip--completed', 'Invoiced': 'chip--invoiced', 'Paid': 'chip--paid',
  'Partially Paid': 'chip--sent', 'Overdue': 'chip--overdue', 'Written Off': 'chip--inactive',
  'Low': 'chip--low', 'Out of Stock': 'chip--outofstock', 'In Stock': 'chip--instock',
  'Active': 'chip--active', 'Inactive': 'chip--inactive', 'PM Due': 'chip--pmdue',
  'In Shop': 'chip--inshop', 'Pending': 'chip--pending', 'Approved': 'chip--approved',
  'Declined': 'chip--declined', 'Sent': 'chip--sent', 'Draft': 'chip--draft',
  'Converted': 'chip--completed', 'Fleet': 'chip--fleet', 'Owner-Op': 'chip--ownerop',
};
function chip(status) {
  return `<span class="chip ${CHIP_MAP[status] || 'chip--open'}">${status}</span>`;
}
function fmt$(n) { return ARS.fmtMoney(n); }

function initGlobalSearch() {
  const input = document.getElementById('globalSearch');
  const box = document.getElementById('searchResults');
  if (!input || !box) return;
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = input.value.trim();
      if (q.length < 2) { box.style.display = 'none'; return; }
      const results = ARS.Data.globalSearch(q);
      if (!results.length) {
        box.innerHTML = '<div style="padding:12px;font-size:.82rem;color:var(--steel)">No results</div>';
      } else {
        box.innerHTML = results.map((r) => `
          <a href="${r.href}" style="display:block;padding:10px 14px;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;font-size:.82rem">
            <div style="font-weight:700">${r.label}</div>
            <div style="color:var(--steel);font-size:.75rem">${r.type} · ${r.sub || ''}</div>
          </a>`).join('');
      }
      box.style.display = 'block';
    }, 200);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.topbar__search')) box.style.display = 'none';
  });
}

function renderNotificationPanel(panel) {
  const notes = ARS.Data.listNotifications().filter((n) => !n.read);
  if (!notes.length) {
    panel.innerHTML = '<div style="padding:14px;font-size:.82rem;color:var(--steel)">No new notifications</div>';
    return;
  }
  panel.innerHTML = notes.map((n) => `
    <a href="${n.href || '#'}" class="notif-item notif-item--${n.type}" data-notif-id="${n.id}" style="display:block;padding:10px 14px;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;font-size:.82rem">
      <div style="font-weight:600">${n.message}</div>
      ${n.entityType ? `<div style="color:var(--steel);font-size:.72rem;margin-top:2px">${n.entityType}</div>` : ''}
    </a>`).join('');
}

function updateNotifDot() {
  const dot = document.getElementById('notifDot');
  if (!dot) return;
  const unread = ARS.Data.listNotifications().filter((n) => !n.read).length;
  dot.style.display = unread ? 'block' : 'none';
}

function initNotifications() {
  const btn = document.getElementById('notifsBtn');
  if (!btn) return;

  let panel = document.getElementById('notifPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'notifPanel';
    panel.style.cssText = 'display:none;position:absolute;top:calc(100% + 6px);right:0;width:320px;max-height:360px;overflow-y:auto;background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:300';
    btn.parentElement.style.position = 'relative';
    btn.parentElement.appendChild(panel);
  }

  updateNotifDot();
  renderNotificationPanel(panel);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = panel.style.display === 'block';
    panel.style.display = open ? 'none' : 'block';
    if (!open) renderNotificationPanel(panel);
  });

  panel.addEventListener('click', async (e) => {
    const link = e.target.closest('[data-notif-id]');
    if (!link) return;
    await ARS.Data.markNotificationRead(link.dataset.notifId);
    updateNotifDot();
    renderNotificationPanel(panel);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#notifsBtn') && !e.target.closest('#notifPanel')) {
      panel.style.display = 'none';
    }
  });

  document.addEventListener('ars:notifications-changed', () => {
    updateNotifDot();
    if (panel.style.display === 'block') renderNotificationPanel(panel);
  });

  document.addEventListener('ars:data-changed', updateNotifDot);
}

function loadScript(src) {
  const build = window.ARS?.APP_BUILD || Date.now();
  const vsrc = src.includes('?') ? src : `${src}?v=${build}`;
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${vsrc}"], script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = vsrc;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function loadAppScripts() {
  try {
    await loadScript('/app/js/firestore-sync.js');
    await loadScript('/app/js/payments-stripe.js');
    if (window.ARSFirebase?.configured) {
      let attempts = 0;
      while (!window.ARSFirebase.db && attempts < 50) {
        await new Promise((r) => setTimeout(r, 100));
        attempts += 1;
      }
    }
    if (window.ARS?.FirestoreSync?.init) await ARS.FirestoreSync.init();
  } catch (e) {
    console.warn('App sync unavailable:', e);
  }
  if (window.ARS?.Data?.init) await ARS.Data.init();
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadScript('/js/firebase-config.js');
    if (window.ARSFirebase?.configured) {
      let attempts = 0;
      while (!window.ARSFirebase.auth && attempts < 50) {
        await new Promise((r) => setTimeout(r, 100));
        attempts += 1;
      }
    }
    if (ARS.Auth?.init) await ARS.Auth.init();
  } catch (e) {
    console.error(e);
    window.location.href = '/login.html?error=firebase';
    return;
  }

  if (!(await ARS.Auth.requireAuth())) return;

  await loadAppScripts();

  const sbEl = document.getElementById('sidebar-placeholder');
  if (sbEl) sbEl.outerHTML = buildSidebar();
  else document.body.insertAdjacentHTML('afterbegin', buildSidebar());

  const tbEl = document.getElementById('topbar-placeholder');
  const title = tbEl?.dataset.title || document.title.split('|')[0].trim();
  if (tbEl) tbEl.outerHTML = buildTopbar(title);

  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.getElementById('appSidebar')?.classList.toggle('open');
    document.getElementById('sidebarOverlay')?.classList.toggle('open');
  });
  document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
    document.getElementById('appSidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('open');
  });

  document.addEventListener('click', async (e) => {
    if (e.target.closest('#logoutBtn')) {
      await ARS.Auth.logout();
      window.location.href = '/login.html';
    }
  });

  document.querySelectorAll('.modal-overlay').forEach((o) => {
    o.addEventListener('click', (e) => { if (e.target === o) o.classList.remove('open'); });
  });
  document.querySelectorAll('[data-close-modal]').forEach((b) => {
    b.addEventListener('click', () => b.closest('.modal-overlay')?.classList.remove('open'));
  });

  initGlobalSearch();
  initNotifications();

  ARS.Store.subscribe(() => {
    document.dispatchEvent(new CustomEvent('ars:data-changed'));
  });

  window.dispatchEvent(new CustomEvent('ars:ready'));
});
