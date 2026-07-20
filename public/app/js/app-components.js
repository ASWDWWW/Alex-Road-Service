/* Alex Road Service — Ops Platform Shared Components */
window.ARS = window.ARS || {};

const NAV_ITEMS = [
  { href: '/app/dashboard.html',   icon: 'fas fa-tachometer-alt',       label: 'Dashboard',   badgeKey: null, perm: null },
  { href: '/app/customers.html',   icon: 'fas fa-users',                 label: 'Customers',   badgeKey: null, perm: null },
  { href: '/app/trucks.html',      icon: 'fas fa-truck',                 label: 'Trucks',      badgeKey: 'trucks', badgeQuery: 'status=PM%20Due', perm: null },
  { href: '/app/work-orders.html', icon: 'fas fa-clipboard-list',        label: 'Work Orders', badgeKey: 'workOrders', badgeQuery: 'status=actionable', perm: null },
  { href: '/app/estimates.html',   icon: 'fas fa-file-alt',              label: 'Estimates',   badgeKey: 'estimates', badgeQuery: 'status=awaiting', perm: 'estimates.create' },
  { href: '/app/invoices.html',    icon: 'fas fa-file-invoice-dollar',   label: 'Invoices',    badgeKey: 'invoices', badgeQuery: 'status=unpaid', perm: 'invoices.create' },
  { href: '/app/payments.html',    icon: 'fas fa-credit-card',           label: 'Payments',    badgeKey: null, perm: 'payments.record' },
  { href: '/app/inventory.html',   icon: 'fas fa-boxes',                 label: 'Inventory',   badgeKey: 'inventory', badgeQuery: 'status=attention', perm: null },
  { href: '/app/employees.html',   icon: 'fas fa-id-badge',              label: 'Employees',   badgeKey: null, perm: 'employees.view' },
  { href: '/app/schedule.html',    icon: 'fas fa-calendar-alt',          label: 'Schedule',    badgeKey: null, perm: 'schedule.view' },
  { href: '/app/messages.html',    icon: 'fas fa-comments',              label: 'Messages',    badgeKey: 'messages', perm: 'messages.view' },
  { href: '/app/reports.html',     icon: 'fas fa-chart-bar',             label: 'Reports',     badgeKey: null, perm: 'reports.view' },
  { href: '/app/settings.html',    icon: 'fas fa-cog',                   label: 'Settings',    badgeKey: null, perm: 'settings.view' },
  { href: '/app/leads.html',       icon: 'fas fa-inbox',                 label: 'Leads',       badgeKey: 'leads', badgeQuery: 'status=New', perm: null },
];

function getAppUser() {
  const u = ARS.Auth?.getUser?.();
  if (!u) return { name: 'Staff', role: 'Staff', initials: 'ST', photoURL: '' };
  return { name: u.name, role: ARS.Auth.displayRole(), initials: ARS.initials(u.name), photoURL: u.photoURL || '' };
}

function avatarStyle(photoURL) {
  return photoURL ? ` style="background-image:url('${photoURL}')"` : '';
}

function navPath(href) {
  return String(href || '').split('?')[0];
}

function navAllowed(href) {
  const role = ARS.Auth?.getRole?.();
  const allowed = ARS.NAV_BY_ROLE?.[role];
  if (!allowed) return true;
  return allowed.includes(navPath(href));
}

/** Action-item counts — badges clear when staff completes the related work */
function getBadges() {
  try {
    const trucks = ARS.Store.getCollection('trucks')
      .filter((t) => t.status === 'PM Due').length;

    const openStatuses = ['Open', 'In Progress', 'Waiting Parts'];
    const workOrders = ARS.Store.getCollection('workOrders')
      .filter((w) => openStatuses.includes(w.status) || (w.status === 'Completed' && !w.invoiced))
      .length;

    const estimates = ARS.Store.getCollection('estimates')
      .filter((e) => ['Pending', 'Sent'].includes(e.status)).length;

    const invoices = ARS.Store.getCollection('invoices')
      .filter((i) => !['Paid', 'Written Off'].includes(i.status)).length;

    const inventory = ARS.Store.getCollection('inventory')
      .filter((p) => p.status === 'Low' || p.status === 'Out of Stock').length;

    const leads = ARS.Store.getCollection('contactSubmissions')
      .filter((l) => !l.status || l.status === 'New').length;

    const messages = ARS.Messaging?.unreadCount?.() || 0;

    return {
      trucks: trucks || null,
      workOrders: workOrders || null,
      estimates: estimates || null,
      invoices: invoices || null,
      inventory: inventory || null,
      leads: leads || null,
      messages: messages || null,
    };
  } catch {
    return {};
  }
}

function updateSidebarBadges() {
  const badges = getBadges();
  const queryByKey = Object.fromEntries(
    NAV_ITEMS.filter((n) => n.badgeKey).map((n) => [n.badgeKey, n.badgeQuery || ''])
  );
  document.querySelectorAll('.sidebar__item[data-badge-key]').forEach((el) => {
    const key = el.dataset.badgeKey;
    const val = badges[key];
    let badgeEl = el.querySelector('.sidebar__badge');
    const base = navPath(el.getAttribute('href') || '');
    const q = queryByKey[key];
    if (val && q) el.setAttribute('href', appHref(`${base}?${q}`));
    else el.setAttribute('href', appHref(base));
    if (val) {
      if (!badgeEl) {
        badgeEl = document.createElement('span');
        badgeEl.className = 'sidebar__badge';
        el.appendChild(badgeEl);
      }
      badgeEl.textContent = String(val);
    } else if (badgeEl) {
      badgeEl.remove();
    }
  });
}

function isActive(href) {
  const p = window.location.pathname;
  const key = navPath(href).split('/').pop().replace('.html', '');
  return p.includes(key);
}

function appHref(path) {
  if (!ARS.isDemoMode?.()) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}demo=1`;
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
    const badgeAttr = n.badgeKey ? ` data-badge-key="${n.badgeKey}"` : '';
    const href = badge && n.badgeQuery ? `${navPath(n.href)}?${n.badgeQuery}` : navPath(n.href);
    return `
    <a href="${appHref(href)}" class="sidebar__item${isActive(n.href) ? ' active' : ''}"${badgeAttr}>
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
    <div class="sidebar__user" id="sidebarUserLink" role="link" tabindex="0" style="cursor:pointer">
      <div class="sidebar__avatar"${avatarStyle(user.photoURL)}>${user.photoURL ? '' : user.initials}</div>
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
  <button type="button" class="topbar__burger btn btn--ghost btn--icon" id="sidebarToggle" aria-label="Open menu" aria-expanded="false" aria-controls="appSidebar"><i class="fas fa-bars" aria-hidden="true"></i></button>
  <div class="topbar__title">${title}</div>
  <div class="topbar__search">
    <i class="fas fa-search" aria-hidden="true"></i>
    <input type="search" placeholder="Search anything…" id="globalSearch" autocomplete="off" aria-label="Search customers, trucks, work orders, and more" aria-autocomplete="list" aria-controls="searchResults" role="combobox" aria-expanded="false">
    <div id="searchResults" class="topbar__search-results" role="listbox" hidden></div>
  </div>
  <div class="topbar__actions">
    <button type="button" class="topbar__icon-btn" id="notifsBtn" title="Notifications" aria-label="Notifications" aria-expanded="false" aria-haspopup="true" aria-controls="notifPanel">
      <i class="fas fa-bell" aria-hidden="true"></i>
      <span class="topbar__notif-dot" id="notifDot" aria-hidden="true"></span>
    </button>
    <div class="topbar__user" id="topbarUserLink" role="link" tabindex="0" title="Your profile" style="cursor:pointer">
      <div class="topbar__user-avatar"${avatarStyle(user.photoURL)}>${user.photoURL ? '' : user.initials}</div>
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

function updateAvatarDOM(photoURL, initials) {
  document.querySelectorAll('.sidebar__avatar, .topbar__user-avatar').forEach((el) => {
    el.style.backgroundImage = photoURL ? `url('${photoURL}')` : '';
    el.textContent = photoURL ? '' : initials;
  });
}

function ensureProfileModal() {
  if (document.getElementById('profileMediaModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="profileMediaModal">
      <div class="modal" style="max-width:480px">
        <div class="modal__header">
          <div class="modal__title">Your Profile</div>
          <button class="modal__close" data-close-modal><i class="fas fa-times"></i></button>
        </div>
        <div class="modal__body" id="profileModalBody"></div>
        <div class="modal__footer" id="profileModalFooter"></div>
      </div>
    </div>`);
  document.getElementById('profileMediaModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'profileMediaModal') closeModal('profileMediaModal');
  });
}

function scheduleSummaryText(schedule) {
  if (!schedule) return '';
  const days = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
  return days.map(([key, label]) => `${label}: ${schedule[key] || 'Off'}`).join(' · ');
}

function openProfileModal() {
  ensureProfileModal();
  const user = getAppUser();
  const authUser = ARS.Auth?.getUser?.() || {};
  const uid = authUser.uid;
  const employee = uid ? (ARS.Data?.getEmployee?.(uid) || null) : null;
  const profile = employee || authUser;
  const canEditSelf = !!uid && !ARS.isDemoMode?.();
  const schedule = profile.schedule;

  const body = document.getElementById('profileModalBody');
  body.innerHTML = `
    <div id="profileAvatarMount"></div>
    <div style="margin:14px 0 16px">
      <div style="font-weight:700;font-size:1.05rem;color:var(--black)">${user.name}</div>
      <div style="color:var(--steel);font-size:.85rem">${user.role}${profile.jobTitle ? ' · ' + profile.jobTitle : ''}</div>
    </div>
    <div class="detail-info-grid" style="margin-bottom:16px">
      <div><span style="color:var(--steel)">Email:</span> ${authUser.email || '—'}</div>
      <div><span style="color:var(--steel)">Department:</span> ${profile.department || '—'}</div>
      <div><span style="color:var(--steel)">Hire date:</span> ${profile.hireDate ? ARS.fmtDate(profile.hireDate) : '—'}</div>
      <div><span style="color:var(--steel)">Status:</span> ${profile.status || 'Active'}</div>
    </div>
    ${schedule ? `
    <div style="margin-bottom:16px">
      <div class="form-label">Weekly schedule</div>
      <div style="color:var(--steel);font-size:.82rem;line-height:1.6">${scheduleSummaryText(schedule)}</div>
      ${schedule.notes ? `<div style="color:var(--steel);font-size:.8rem;margin-top:4px;font-style:italic">${schedule.notes}</div>` : ''}
    </div>` : ''}
    <div class="form-row"><label class="form-label">Phone</label><input class="form-input" id="profilePhone" value="${profile.phone || ''}" ${canEditSelf ? '' : 'disabled'}></div>
    <div class="form-row"><label class="form-label">Address</label><input class="form-input" id="profileAddress" value="${profile.address || ''}" ${canEditSelf ? '' : 'disabled'}></div>
    <div class="form-row-2">
      <div class="form-row"><label class="form-label">Emergency contact name</label><input class="form-input" id="profileEcName" value="${profile.emergencyContact?.name || ''}" ${canEditSelf ? '' : 'disabled'}></div>
      <div class="form-row"><label class="form-label">Emergency contact phone</label><input class="form-input" id="profileEcPhone" value="${profile.emergencyContact?.phone || ''}" ${canEditSelf ? '' : 'disabled'}></div>
    </div>`;

  const footer = document.getElementById('profileModalFooter');
  footer.innerHTML = `
    <button class="btn btn--secondary" data-close-modal>Close</button>
    ${ARS.can('settings.view') ? `<a class="btn btn--secondary" id="profileSettingsLink" href="${appHref('/app/settings.html')}">Open Settings</a>` : ''}
    ${canEditSelf ? `<button class="btn btn--primary" id="profileSaveBtn"><i class="fas fa-save"></i> Save</button>` : ''}`;

  document.querySelectorAll('#profileMediaModal [data-close-modal]').forEach((b) => {
    b.addEventListener('click', () => closeModal('profileMediaModal'));
  });

  document.getElementById('profileSaveBtn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await ARS.Data.updateEmployee(uid, {
        phone: document.getElementById('profilePhone').value.trim(),
        address: document.getElementById('profileAddress').value.trim(),
        emergencyContact: {
          name: document.getElementById('profileEcName').value.trim(),
          phone: document.getElementById('profileEcPhone').value.trim(),
        },
      });
      showToast('Profile updated', 'success');
      closeModal('profileMediaModal');
    } catch (err) {
      showToast(err.message || 'Update failed', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  if (uid) {
    ARS.MediaUI.mountSingleImage(document.getElementById('profileAvatarMount'), {
      title: 'Profile photo',
      currentUrl: user.photoURL,
      entityType: 'avatar',
      entityId: uid,
      canEdit: true,
      onUploaded: async (item) => {
        if (!ARS.isDemoMode?.() && window.ARSFirebase?.updateUserProfile) {
          await window.ARSFirebase.updateUserProfile(uid, { photoURL: item.url });
        }
        await ARS.Auth.setPhotoURL(item.url);
        updateAvatarDOM(item.url, user.initials);
      },
      onCleared: async () => {
        if (!ARS.isDemoMode?.() && window.ARSFirebase?.updateUserProfile) {
          await window.ARSFirebase.updateUserProfile(uid, { photoURL: '' });
        }
        await ARS.Auth.setPhotoURL('');
        updateAvatarDOM('', user.initials);
      },
    });
  }
  openModal('profileMediaModal');
}

const CHIP_MAP = {
  'Open': 'chip--open', 'In Progress': 'chip--inprogress', 'Waiting Parts': 'chip--waiting',
  'Completed': 'chip--completed', 'Invoiced': 'chip--invoiced', 'Paid': 'chip--paid',
  'Partially Paid': 'chip--sent', 'Overdue': 'chip--overdue', 'Written Off': 'chip--inactive',
  'Low': 'chip--low', 'Out of Stock': 'chip--outofstock', 'In Stock': 'chip--instock',
  'Active': 'chip--active', 'Inactive': 'chip--inactive', 'PM Due': 'chip--pmdue',
  'In Shop': 'chip--inshop', 'Pending': 'chip--pending', 'Approved': 'chip--approved',
  'Declined': 'chip--declined', 'Sent': 'chip--sent', 'Draft': 'chip--draft',
  'Converted': 'chip--completed', 'Fleet': 'chip--fleet', 'Owner-Op': 'chip--ownerop',
  'New': 'chip--open', 'Contacted': 'chip--sent', 'Closed': 'chip--inactive',
  'Refunded': 'chip--refunded', 'Refund Complete': 'chip--refunded', 'Partially Refunded': 'chip--partial-refund',
  'On Leave': 'chip--onleave', 'Terminated': 'chip--terminated', 'Archived': 'chip--terminated',
};
function chip(status) {
  return `<span class="chip ${CHIP_MAP[status] || 'chip--open'}">${status}</span>`;
}
function fmt$(n) { return ARS.fmtMoney(n); }

function initSidebarNav() {
  const sidebar = document.getElementById('appSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const toggle = document.getElementById('sidebarToggle');
  if (!sidebar || !toggle) return;

  const setOpen = (open) => {
    sidebar.classList.toggle('open', open);
    overlay?.classList.toggle('open', open);
    document.body.classList.toggle('sidebar-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };

  const isOpen = () => sidebar.classList.contains('open');

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!isOpen());
  });
  overlay?.addEventListener('click', () => setOpen(false));

  sidebar.addEventListener('click', (e) => {
    if (e.target.closest('a.sidebar__item')) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) setOpen(false);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && isOpen()) setOpen(false);
  });
}

function initGlobalSearch() {
  const input = document.getElementById('globalSearch');
  const box = document.getElementById('searchResults');
  if (!input || !box) return;
  let timer;
  let lastResults = [];
  let activeIdx = -1;

  const setOpen = (open) => {
    box.classList.toggle('is-open', open);
    box.hidden = !open;
    input.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) activeIdx = -1;
  };

  const highlight = () => {
    box.querySelectorAll('[data-search-idx]').forEach((el) => {
      el.classList.toggle('is-active', Number(el.dataset.searchIdx) === activeIdx);
    });
  };

  const renderResults = (results) => {
    lastResults = results;
    activeIdx = results.length ? 0 : -1;
    if (!results.length) {
      box.innerHTML = '<div style="padding:12px;font-size:.82rem;color:var(--steel)">No results</div>';
    } else {
      box.innerHTML = results.map((r, i) => `
        <a href="${appHref(r.href)}" role="option" data-search-idx="${i}" id="searchOpt${i}" style="display:block;padding:10px 14px;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;font-size:.82rem">
          <div style="font-weight:700">${r.label}</div>
          <div style="color:var(--steel);font-size:.75rem">${r.type} · ${r.sub || ''}</div>
        </a>`).join('');
    }
    setOpen(true);
    highlight();
  };

  const runSearch = () => {
    const q = input.value.trim();
    if (q.length < 2) {
      lastResults = [];
      setOpen(false);
      return;
    }
    renderResults(ARS.Data.globalSearch(q));
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(runSearch, 180);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2) runSearch();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      input.blur();
      return;
    }
    if (!box.classList.contains('is-open') || !lastResults.length) {
      if (e.key === 'Enter' && input.value.trim().length >= 2) {
        e.preventDefault();
        runSearch();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = (activeIdx + 1) % lastResults.length;
      highlight();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = (activeIdx - 1 + lastResults.length) % lastResults.length;
      highlight();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const pick = lastResults[activeIdx >= 0 ? activeIdx : 0];
      if (pick) window.location.href = appHref(pick.href);
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.topbar__search')) setOpen(false);
  });
}

function renderNotificationPanel(panel) {
  const notes = ARS.Data.listNotifications().slice(0, 25);
  const unread = notes.filter((n) => !n.read).length;
  if (!notes.length) {
    panel.innerHTML = '<div class="topbar__notif-empty">No notifications</div>';
    return;
  }
  panel.innerHTML = `
    <div class="topbar__notif-header">
      <strong>${unread ? `${unread} unread` : 'Notifications'}</strong>
      ${unread ? '<button type="button" class="btn btn--ghost btn--sm" id="markAllNotifsRead">Mark all read</button>' : ''}
    </div>
    ${notes.map((n) => `
    <a href="${appHref(n.href || '#')}" class="notif-item notif-item--${n.type || 'info'}${n.read ? ' notif-item--read' : ''}" data-notif-id="${n.id}" style="display:block;padding:10px 14px;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;font-size:.82rem">
      <div style="font-weight:${n.read ? '500' : '600'}">${n.message}</div>
      ${n.entityType ? `<div style="color:var(--steel);font-size:.72rem;margin-top:2px">${n.entityType}${n.read ? ' · read' : ''}</div>` : ''}
    </a>`).join('')}`;
}

function updateNotifDot() {
  const dot = document.getElementById('notifDot');
  const btn = document.getElementById('notifsBtn');
  if (!dot) return;
  const unread = ARS.Data.listNotifications().filter((n) => !n.read).length;
  dot.classList.toggle('is-on', unread > 0);
  if (btn) {
    btn.setAttribute('aria-label', unread ? `Notifications (${unread} unread)` : 'Notifications');
    btn.title = unread ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'Notifications';
  }
}

function initNotifications() {
  const btn = document.getElementById('notifsBtn');
  if (!btn) return;

  let panel = document.getElementById('notifPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'notifPanel';
    panel.className = 'topbar__notif-panel';
    panel.setAttribute('role', 'menu');
    panel.setAttribute('aria-label', 'Notifications');
    btn.parentElement.appendChild(panel);
  }

  const setOpen = (open) => {
    panel.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      ARS.Data.refreshNotifications();
      renderNotificationPanel(panel);
    }
  };

  const isOpen = () => panel.classList.contains('is-open');

  ARS.Data.refreshNotifications();
  updateNotifDot();
  renderNotificationPanel(panel);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!isOpen());
  });

  panel.addEventListener('click', async (e) => {
    if (e.target.closest('#markAllNotifsRead')) {
      e.preventDefault();
      e.stopPropagation();
      await ARS.Data.markAllNotificationsRead();
      updateNotifDot();
      renderNotificationPanel(panel);
      return;
    }
    const link = e.target.closest('[data-notif-id]');
    if (!link) return;
    await ARS.Data.markNotificationRead(link.dataset.notifId);
    updateNotifDot();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#notifsBtn') && !e.target.closest('#notifPanel')) {
      setOpen(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) setOpen(false);
  });

  document.addEventListener('ars:notifications-changed', () => {
    updateNotifDot();
    if (isOpen()) renderNotificationPanel(panel);
  });

  document.addEventListener('ars:data-changed', () => {
    ARS.Data.refreshNotifications();
    updateNotifDot();
    updateSidebarBadges();
    if (isOpen()) renderNotificationPanel(panel);
  });
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

function pageNeedsStripe() {
  const p = location.pathname;
  return /invoice|payment/i.test(p);
}

function waitForFirebaseReady(maxMs = 4000) {
  const step = 50;
  let attempts = 0;
  const max = Math.ceil(maxMs / step);
  return new Promise((resolve) => {
    const tick = () => {
      if (window.ARSFirebase?.db && window.ARSFirebase?.auth) return resolve(true);
      if (attempts++ >= max) return resolve(!!window.ARSFirebase?.configured);
      setTimeout(tick, step);
    };
    tick();
  });
}

async function loadAppScripts() {
  if (ARS.isDemoMode?.()) {
    ARS.Demo?.getState?.();
    if (window.ARS?.Data?.init) await ARS.Data.init();
    return { usedCache: true, syncPromise: Promise.resolve() };
  }

  const cacheWarm = !!ARS.Store?.hasLocalCache?.();
  let syncPromise = Promise.resolve();

  try {
    const loads = [
      loadScript('/app/js/firestore-sync.js'),
      loadScript('/app/js/media-service.js'),
      loadScript('/app/js/media-ui.js'),
      loadScript('/app/js/vin-lookup.js'),
      loadScript('/app/js/messaging-crypto.js'),
      loadScript('/app/js/messaging-service.js'),
      loadScript('/app/js/schedule-service.js'),
    ];
    if (pageNeedsStripe()) loads.push(loadScript('/app/js/payments-stripe.js'));
    await Promise.all(loads);

    if (window.ARSFirebase?.configured) {
      await waitForFirebaseReady(4000);
    }

    if (window.ARS?.FirestoreSync?.init) {
      syncPromise = ARS.FirestoreSync.init().catch((e) => {
        console.warn('App sync unavailable:', e);
      });
      // Cold start: wait for critical hydrate. Warm cache: paint immediately.
      if (!cacheWarm) await syncPromise;
    }
  } catch (e) {
    console.warn('App sync unavailable:', e);
  }

  if (window.ARS?.Data?.init) await ARS.Data.init();
  return { usedCache: cacheWarm, syncPromise };
}

document.addEventListener('DOMContentLoaded', async () => {
  const cacheWarm = !!(ARS.Store?.hasLocalCache?.()) || !!ARS.isDemoMode?.();
  if (!cacheWarm) {
    document.body.classList.add('app-booting');
    ensureBootOverlay();
  } else {
    ensureSyncChip('Refreshing…');
  }

  if (new URLSearchParams(window.location.search).get('demo') === '1') {
    ARS.markDemoSession?.();
  }
  try {
    await loadScript('/js/firebase-config.js');
    if (window.ARSFirebase?.configured && !ARS.isDemoMode?.()) {
      await waitForFirebaseReady(4000);
    }
    if (ARS.Auth?.init) await ARS.Auth.init();
  } catch (e) {
    if (!ARS.isDemoMode?.()) {
      console.error(e);
      window.location.href = '/login.html?error=firebase';
      return;
    }
  }

  if (!(await ARS.Auth.requireAuth())) return;

  const { usedCache, syncPromise } = await loadAppScripts();

  if (ARS.isDemoMode?.() && pageNeedsStripe()) {
    await loadScript('/app/js/payments-stripe.js');
  }

  const sbEl = document.getElementById('sidebar-placeholder');
  if (sbEl) sbEl.outerHTML = buildSidebar();
  else document.body.insertAdjacentHTML('afterbegin', buildSidebar());

  const tbEl = document.getElementById('topbar-placeholder');
  const title = tbEl?.dataset.title || document.title.split('|')[0].trim();
  if (tbEl) tbEl.outerHTML = buildTopbar(title);

  initSidebarNav();

  document.addEventListener('click', async (e) => {
    if (e.target.closest('#logoutBtn')) {
      const ok = ARS.Pages?.confirmAsync
        ? await ARS.Pages.confirmAsync({ title: 'Sign out', message: 'Sign out of the ops platform?', okLabel: 'Sign out' })
        : confirm('Sign out of the ops platform?');
      if (!ok) return;
      await ARS.Auth.logout();
      window.location.href = '/login.html';
    }
    if (e.target.closest('#topbarUserLink') || e.target.closest('#sidebarUserLink')) {
      openProfileModal();
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
  updateSidebarBadges();

  if (ARS.isDemoMode?.()) {
    document.body.classList.add('demo-active');
    const main = document.querySelector('.app-main');
    if (main) {
      const banner = document.createElement('div');
      banner.className = 'demo-banner';
      banner.innerHTML = '<i class="fas fa-flask"></i> Demo mode — sample data only. Changes reset when you sign out and back in.';
      main.insertBefore(banner, main.firstChild);
    }
  }

  ARS.Store.subscribe(() => {
    document.dispatchEvent(new CustomEvent('ars:data-changed'));
  });

  window.__ARS_APP_READY = true;
  window.dispatchEvent(new CustomEvent('ars:ready'));
  document.dispatchEvent(new CustomEvent('ars:ready'));
  document.dispatchEvent(new CustomEvent('ars:data-changed'));

  if (ARS.can?.('messages.view') && ARS.Messaging?.init) {
    ARS.Messaging.init()
      .then(() => updateSidebarBadges())
      .catch((e) => console.warn('Messaging init:', e.message));
    document.addEventListener('ars:messages-changed', updateSidebarBadges);
  }

  document.body.classList.remove('app-booting');
  document.body.classList.add('app-ready');
  removeBootOverlay();

  // Background sync indicator for warm-cache / remaining collections
  if (!ARS.isDemoMode?.() && window.ARSFirebase?.configured) {
    const stillSyncing = !ARS.FirestoreSync?.isHydrated?.() || !ARS.FirestoreSync?.isFullySynced?.();
    if (stillSyncing || usedCache) {
      ensureSyncChip('Syncing…');
      const hide = () => removeSyncChip();
      document.addEventListener('ars:data-synced', hide, { once: true });
      document.addEventListener('ars:data-hydrated', () => {
        if (ARS.FirestoreSync?.isFullySynced?.()) hide();
        else ensureSyncChip('Syncing…');
      }, { once: true });
      Promise.resolve(syncPromise).finally(() => {
        if (ARS.FirestoreSync?.isFullySynced?.()) hide();
        setTimeout(hide, 10000);
      });
    } else {
      removeSyncChip();
    }
  } else {
    removeSyncChip();
  }
});

function ensureBootOverlay() {
  if (document.getElementById('appBootOverlay')) return;
  const el = document.createElement('div');
  el.id = 'appBootOverlay';
  el.className = 'app-boot-overlay';
  el.innerHTML = `
    <div class="app-boot-overlay__card">
      <div class="loading-state__spinner"></div>
      <div class="app-boot-overlay__title">Loading ops platform</div>
      <div class="app-boot-overlay__sub">Syncing customers, jobs, and invoices…</div>
    </div>`;
  document.body.appendChild(el);
}

function removeBootOverlay() {
  const el = document.getElementById('appBootOverlay');
  if (!el) return;
  el.classList.add('app-boot-overlay--hide');
  setTimeout(() => el.remove(), 280);
}

function ensureSyncChip(text) {
  let el = document.getElementById('appSyncChip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'appSyncChip';
    el.className = 'app-sync-chip';
    el.innerHTML = `<span class="app-sync-chip__spinner"></span><span class="app-sync-chip__text"></span>`;
    document.body.appendChild(el);
  }
  el.querySelector('.app-sync-chip__text').textContent = text || 'Syncing…';
  el.classList.remove('app-sync-chip--hide');
}

function removeSyncChip() {
  const el = document.getElementById('appSyncChip');
  if (!el) return;
  el.classList.add('app-sync-chip--hide');
  setTimeout(() => el.remove(), 250);
}
