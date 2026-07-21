/* Schedule page controller: day, week, and month calendar views */
window.ARS = window.ARS || {};

(() => {
  const VIEW_STORAGE_KEY = 'ars_schedule_view';
  const VALID_VIEWS = new Set(['day', 'week', 'month']);
  const state = {
    view: VALID_VIEWS.has(localStorage.getItem(VIEW_STORAGE_KEY))
      ? localStorage.getItem(VIEW_STORAGE_KEY)
      : 'month',
    anchor: new Date(),
    selectedDate: null,
    editingId: null,
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));

  const meUid = () => ARS.Auth.getUser()?.uid || '';
  const canManage = () => ARS.can('schedule.manage');
  const pad = (value) => String(value).padStart(2, '0');

  function dateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function fromDateKey(value) {
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  function addDays(value, amount) {
    const date = new Date(value);
    date.setDate(date.getDate() + amount);
    return date;
  }

  function startOfWeek(value) {
    const date = new Date(value);
    date.setDate(date.getDate() - date.getDay());
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function endOfWeek(value) {
    const date = addDays(startOfWeek(value), 6);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  function visibleRange() {
    if (state.view === 'day') {
      const start = new Date(state.anchor);
      const end = new Date(state.anchor);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (state.view === 'week') {
      return { start: startOfWeek(state.anchor), end: endOfWeek(state.anchor) };
    }
    const bounds = ARS.Schedule.monthBounds(state.anchor.getFullYear(), state.anchor.getMonth());
    return { start: bounds.gridStart, end: bounds.gridEnd };
  }

  function filterEmployeeId() {
    const value = document.getElementById('scheduleEmployeeFilter')?.value || '';
    return canManage() ? (value || null) : meUid();
  }

  function staffList() {
    return ARS.Data.listEmployees()
      .filter((employee) => employee.active !== false
        && employee.status !== 'Archived'
        && employee.status !== 'Terminated')
      .map((employee) => ({
        uid: employee.uid || employee.id,
        name: employee.name,
        email: employee.email || '',
        role: employee.role,
      }));
  }

  function populateEmployeeFilter() {
    const select = document.getElementById('scheduleEmployeeFilter');
    const requested = new URLSearchParams(location.search).get('employeeId') || '';
    if (!canManage()) {
      select.innerHTML = `<option value="${esc(meUid())}">My schedule</option>`;
      select.value = meUid();
      select.disabled = true;
      return;
    }
    select.innerHTML = '<option value="">All employees</option>'
      + staffList().map((employee) => (
        `<option value="${esc(employee.uid)}">${esc(employee.name)}</option>`
      )).join('');
    if (requested && [...select.options].some((option) => option.value === requested)) {
      select.value = requested;
    }
  }

  function updateSubtitle() {
    const employeeId = filterEmployeeId();
    const employee = employeeId ? ARS.Data.getEmployee(employeeId) : null;
    document.getElementById('scheduleSub').textContent = canManage()
      ? `${employee?.name || 'All employees'} · Scheduled hours, work orders, and blocks`
      : 'Your scheduled hours, work orders, and team blocks';
  }

  function formatRangeLabel() {
    if (state.view === 'day') {
      return state.anchor.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      });
    }
    if (state.view === 'week') {
      const start = startOfWeek(state.anchor);
      const end = endOfWeek(state.anchor);
      const sameMonth = start.getMonth() === end.getMonth();
      const startLabel = start.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
      });
      const endLabel = end.toLocaleDateString('en-US', {
        month: sameMonth ? undefined : 'short', day: 'numeric', year: 'numeric',
      });
      return `${startLabel} – ${endLabel}`;
    }
    return state.anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function formatTimeRange(event) {
    if (event.allDay) return event.shiftLabel || 'All day';
    const options = { hour: 'numeric', minute: '2-digit' };
    const start = new Date(event.startAt).toLocaleTimeString([], options);
    const end = new Date(event.endAt).toLocaleTimeString([], options);
    return `${start} – ${end}`;
  }

  function eventKind(event) {
    if (event.source === 'shift') return 'Scheduled hours';
    if (event.source === 'workOrder') return event.status || 'Work order';
    return ARS.Schedule.typeMeta(event.type).label;
  }

  function eventNames(event) {
    if (event.employeeNames) return Object.values(event.employeeNames).filter(Boolean).join(', ');
    return (event.employeeIds || []).map((uid) => ARS.Data.getEmployee(uid)?.name || uid).join(', ');
  }

  function eventAction(event) {
    if (event.source === 'workOrder') {
      return `<a class="btn btn--ghost btn--sm" href="${ARS.Pages.appHref(`/app/work-order-detail.html?id=${encodeURIComponent(event.workOrderId)}`)}">Open WO</a>`;
    }
    if (event.source === 'block' && (canManage() || event.createdBy === meUid())) {
      return `<button type="button" class="btn btn--secondary btn--sm" data-edit-block="${esc(event.id)}">Edit</button>`;
    }
    return '';
  }

  function eventCard(event, compact = false) {
    const names = eventNames(event);
    return `
      <article class="cal-event ${compact ? 'cal-event--compact' : ''}" style="--event-color:${esc(event.color || '#64635D')}">
        <div class="cal-event__top">
          <div class="cal-event__content">
            <div class="cal-event__title">${esc(event.title)}</div>
            <div class="cal-event__meta">
              <span>${esc(formatTimeRange(event))}</span>
              <span>${esc(eventKind(event))}</span>
              ${names && !event.title.startsWith(names) ? `<span>${esc(names)}</span>` : ''}
            </div>
            ${!compact && (event.notes || event.desc)
              ? `<div class="cal-event__notes">${esc(event.notes || event.desc)}</div>`
              : ''}
          </div>
          ${eventAction(event) ? `<div class="cal-event__actions">${eventAction(event)}</div>` : ''}
        </div>
      </article>`;
  }

  function chip(event) {
    const icon = event.source === 'shift'
      ? 'fa-clock'
      : event.source === 'workOrder' ? 'fa-wrench' : 'fa-square';
    return `
      <button type="button" class="cal-chip cal-chip--${esc(event.source)}"
        style="--chip:${esc(event.color || '#64635D')}"
        data-event-id="${esc(event.id)}" title="${esc(`${event.title} · ${formatTimeRange(event)}`)}">
        <i class="fas ${icon}" aria-hidden="true"></i><span>${esc(event.title)}</span>
      </button>`;
  }

  function renderMonth(host) {
    const bounds = ARS.Schedule.monthBounds(state.anchor.getFullYear(), state.anchor.getMonth());
    const today = dateKey(new Date());
    const cells = [];
    for (let cursor = new Date(bounds.gridStart); cursor <= bounds.gridEnd; cursor = addDays(cursor, 1)) {
      const day = new Date(cursor);
      const key = dateKey(day);
      const events = ARS.Schedule.eventsForDay(day, filterEmployeeId());
      const shifts = events.filter((event) => event.source === 'shift');
      const inMonth = day.getMonth() === state.anchor.getMonth();
      const employeeColors = [...new Set(shifts.map((event) => event.color))];
      const shiftGradient = employeeColors.length
        ? ` style="--shift-day-color:${employeeColors[0]}"`
        : '';
      cells.push(`
        <section class="cal-cell ${inMonth ? '' : 'is-out'} ${key === today ? 'is-today' : ''} ${key === state.selectedDate ? 'is-selected' : ''} ${shifts.length ? 'has-shift' : ''}"
          data-date="${key}"${shiftGradient}>
          <button type="button" class="cal-cell__date" data-select-date="${key}"
            aria-label="${esc(day.toLocaleDateString())}">
            <span>${day.getDate()}</span>
            ${shifts.length ? `<span class="cal-shift-count">${shifts.length} scheduled</span>` : ''}
          </button>
          <div class="cal-cell__events">
            ${events.slice(0, 5).map(chip).join('')}
            ${events.length > 5 ? `<button type="button" class="cal-more" data-select-date="${key}">+${events.length - 5} more</button>` : ''}
          </div>
        </section>`);
    }
    host.innerHTML = `
      <div class="cal-grid-head" aria-hidden="true">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
      <div class="cal-grid">${cells.join('')}</div>`;
  }

  function renderWeek(host) {
    const start = startOfWeek(state.anchor);
    const today = dateKey(new Date());
    const columns = [];
    for (let index = 0; index < 7; index += 1) {
      const day = addDays(start, index);
      const key = dateKey(day);
      const events = ARS.Schedule.eventsForDay(day, filterEmployeeId());
      columns.push(`
        <section class="cal-week__day ${key === today ? 'is-today' : ''}">
          <button type="button" class="cal-week__heading" data-select-date="${key}" data-open-day="${key}">
            <span>${day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
            <strong>${day.getDate()}</strong>
          </button>
          <div class="cal-week__events">
            ${events.length ? events.map((event) => eventCard(event, true)).join('')
              : '<div class="cal-empty-slot">No schedule</div>'}
          </div>
        </section>`);
    }
    host.innerHTML = `<div class="cal-week">${columns.join('')}</div>`;
  }

  function renderDayView(host) {
    const events = ARS.Schedule.eventsForDay(state.anchor, filterEmployeeId());
    const shiftCount = events.filter((event) => event.source === 'shift').length;
    const woCount = events.filter((event) => event.source === 'workOrder').length;
    const blockCount = events.filter((event) => event.source === 'block').length;
    host.innerHTML = `
      <div class="cal-day-summary">
        <div><strong>${shiftCount}</strong><span>Scheduled</span></div>
        <div><strong>${woCount}</strong><span>Work orders</span></div>
        <div><strong>${blockCount}</strong><span>Other blocks</span></div>
      </div>
      <div class="cal-agenda">
        ${events.length ? events.map((event) => eventCard(event)).join('')
          : `<div class="cal-empty-state">
              <i class="far fa-calendar-check"></i>
              <strong>Nothing scheduled</strong>
              <span>Add a block or assign a work order for this day.</span>
            </div>`}
      </div>`;
  }

  function renderSelectedDay() {
    const panel = document.getElementById('calDayPanel');
    if (!state.selectedDate || state.view === 'day') {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    const day = fromDateKey(state.selectedDate);
    document.getElementById('calDayTitle').textContent = day.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const events = ARS.Schedule.eventsForDay(day, filterEmployeeId());
    document.getElementById('calDayBody').innerHTML = events.length
      ? events.map((event) => eventCard(event)).join('')
      : '<div class="cal-empty-slot">Nothing scheduled for this day.</div>';
  }

  function render() {
    document.getElementById('calRangeLabel').textContent = formatRangeLabel();
    document.querySelectorAll('[data-calendar-view]').forEach((button) => {
      const active = button.dataset.calendarView === state.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const host = document.getElementById('calViewHost');
    host.className = `cal-view-host cal-view-host--${state.view}`;
    if (state.view === 'day') renderDayView(host);
    else if (state.view === 'week') renderWeek(host);
    else renderMonth(host);
    renderSelectedDay();
  }

  async function reload() {
    const range = visibleRange();
    await ARS.Schedule.listenRange(range.start, range.end, filterEmployeeId());
    render();
  }

  function renderEmployeePicker(selected = []) {
    const element = document.getElementById('sbEmpPicker');
    const queryText = document.getElementById('sbEmpSearch').value.trim().toLowerCase();
    const selectedIds = new Set(selected);
    const employees = staffList().filter((employee) => !queryText
      || employee.name.toLowerCase().includes(queryText)
      || employee.email.toLowerCase().includes(queryText));
    element.innerHTML = employees.map((employee) => `
      <label class="tech-picker__row">
        <input type="checkbox" value="${esc(employee.uid)}" ${selectedIds.has(employee.uid) ? 'checked' : ''}>
        <span>${esc(employee.name)}
          <span class="td-muted">· ${esc(ARS.ROLE_LABELS[employee.role] || employee.role || '')}</span>
        </span>
      </label>`).join('') || '<div class="cal-empty-slot">No employees found</div>';
  }

  function audienceMode() {
    return document.querySelector('input[name="sbTarget"]:checked')?.value || 'selected';
  }

  function syncAudienceUi() {
    const manager = canManage();
    document.getElementById('sbTargetAllLabel').hidden = !manager;
    document.getElementById('sbTargetSelectLabel').hidden = !manager;
    if (!manager) document.getElementById('sbTargetSelf').checked = true;
    const showPicker = manager && audienceMode() === 'selected';
    document.getElementById('sbEmpSearch').hidden = !showPicker;
    document.getElementById('sbEmpPicker').hidden = !showPicker;
  }

  function toLocalInput(value) {
    const date = new Date(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function openBlockModal(preset = {}) {
    state.editingId = preset.id || null;
    document.getElementById('scheduleBlockModalTitle').textContent = state.editingId
      ? 'Edit schedule block'
      : 'Add schedule block';
    document.getElementById('sbTitle').value = preset.title || '';
    document.getElementById('sbType').value = preset.type || 'meeting';
    document.getElementById('sbColor').value = preset.color || ARS.Schedule.typeMeta(preset.type || 'meeting').color;
    document.getElementById('sbNotes').value = preset.notes || '';
    document.getElementById('sbAllDay').checked = !!preset.allDay;

    const base = state.selectedDate ? fromDateKey(state.selectedDate) : new Date(state.anchor);
    const start = preset.startAt ? new Date(preset.startAt) : base;
    if (!preset.startAt) start.setHours(9, 0, 0, 0);
    const end = preset.endAt ? new Date(preset.endAt) : new Date(start.getTime() + 60 * 60 * 1000);
    document.getElementById('sbStart').value = toLocalInput(start);
    document.getElementById('sbEnd').value = toLocalInput(end);

    const ids = preset.employeeIds || (filterEmployeeId() ? [filterEmployeeId()] : []);
    if (!canManage() || (!state.editingId && ids.length === 1 && ids[0] === meUid())) {
      document.getElementById('sbTargetSelf').checked = true;
    } else if (preset.targetAll) {
      document.getElementById('sbTargetAll').checked = true;
    } else {
      document.getElementById('sbTargetSelected').checked = true;
    }
    renderEmployeePicker(ids);
    syncAudienceUi();
    document.getElementById('sbDeleteBtn').hidden = !state.editingId
      || (!canManage() && preset.createdBy !== meUid());
    openModal('scheduleBlockModal');
  }

  async function saveBlock() {
    const title = document.getElementById('sbTitle').value.trim();
    const startValue = document.getElementById('sbStart').value;
    const endValue = document.getElementById('sbEnd').value;
    if (!title || !startValue || !endValue) {
      showToast('Title, start, and end are required', 'error');
      return;
    }
    const allDay = document.getElementById('sbAllDay').checked;
    const start = new Date(startValue);
    const end = new Date(endValue);
    if (allDay) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }
    if (end <= start) {
      showToast('End must be after start', 'error');
      return;
    }

    const mode = audienceMode();
    let employeeIds;
    let targetAll = false;
    if (!canManage() || mode === 'self') employeeIds = [meUid()];
    else if (mode === 'all') {
      targetAll = true;
      employeeIds = ARS.Schedule.activeEmployeeIds();
    } else {
      employeeIds = [...document.querySelectorAll('#sbEmpPicker input:checked')].map((input) => input.value);
    }
    if (!employeeIds.length) {
      showToast('Select at least one employee', 'error');
      return;
    }

    const payload = {
      title,
      type: document.getElementById('sbType').value,
      color: document.getElementById('sbColor').value,
      notes: document.getElementById('sbNotes').value.trim(),
      allDay,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      employeeIds,
      targetAll,
    };
    const button = document.getElementById('sbSaveBtn');
    button.disabled = true;
    try {
      if (state.editingId) await ARS.Schedule.updateBlock(state.editingId, payload);
      else await ARS.Schedule.createBlock(payload);
      closeModal('scheduleBlockModal');
      showToast(state.editingId ? 'Schedule block updated' : 'Schedule block added', 'success');
      await reload();
    } catch (error) {
      showToast(error.message || 'Could not save schedule block', 'error');
    } finally {
      button.disabled = false;
    }
  }

  function findBlock(id) {
    return ARS.Schedule.getBlocks().find((block) => block.id === id);
  }

  async function markScheduleNotificationsRead() {
    const notifications = ARS.Data.listNotifications()
      .filter((notification) => notification.entityType === 'schedule' && !notification.read);
    await Promise.all(notifications.map((notification) => ARS.Data.markNotificationRead(notification.id)));
  }

  function bindEvents() {
    document.querySelectorAll('[data-calendar-view]').forEach((button) => {
      button.addEventListener('click', async () => {
        state.view = button.dataset.calendarView;
        localStorage.setItem(VIEW_STORAGE_KEY, state.view);
        await reload();
      });
    });
    document.getElementById('calPrev').addEventListener('click', async () => {
      if (state.view === 'day') state.anchor = addDays(state.anchor, -1);
      else if (state.view === 'week') state.anchor = addDays(state.anchor, -7);
      else state.anchor = new Date(state.anchor.getFullYear(), state.anchor.getMonth() - 1, 1);
      state.selectedDate = dateKey(state.anchor);
      await reload();
    });
    document.getElementById('calNext').addEventListener('click', async () => {
      if (state.view === 'day') state.anchor = addDays(state.anchor, 1);
      else if (state.view === 'week') state.anchor = addDays(state.anchor, 7);
      else state.anchor = new Date(state.anchor.getFullYear(), state.anchor.getMonth() + 1, 1);
      state.selectedDate = dateKey(state.anchor);
      await reload();
    });
    document.getElementById('scheduleTodayBtn').addEventListener('click', async () => {
      state.anchor = new Date();
      state.selectedDate = dateKey(state.anchor);
      await reload();
    });
    document.getElementById('scheduleEmployeeFilter').addEventListener('change', async () => {
      updateSubtitle();
      await reload();
    });
    document.getElementById('scheduleAddBtn').addEventListener('click', () => openBlockModal());
    document.getElementById('calDayAddBtn').addEventListener('click', () => openBlockModal());
    document.getElementById('sbSaveBtn').addEventListener('click', saveBlock);
    document.getElementById('sbType').addEventListener('change', (event) => {
      document.getElementById('sbColor').value = ARS.Schedule.typeMeta(event.target.value).color;
    });
    document.getElementById('sbEmpSearch').addEventListener('input', () => {
      const selected = [...document.querySelectorAll('#sbEmpPicker input:checked')].map((input) => input.value);
      renderEmployeePicker(selected);
    });
    document.querySelectorAll('input[name="sbTarget"]').forEach((radio) => {
      radio.addEventListener('change', syncAudienceUi);
    });
    document.getElementById('sbDeleteBtn').addEventListener('click', async () => {
      if (!state.editingId) return;
      const confirmed = await ARS.Pages.confirmAsync({
        title: 'Delete schedule block',
        message: 'Remove this block from every assigned employee?',
        okLabel: 'Delete',
      });
      if (!confirmed) return;
      try {
        await ARS.Schedule.deleteBlock(state.editingId);
        closeModal('scheduleBlockModal');
        showToast('Schedule block deleted', 'success');
        await reload();
      } catch (error) {
        showToast(error.message || 'Could not delete block', 'error');
      }
    });

    document.getElementById('calViewHost').addEventListener('click', async (event) => {
      const editButton = event.target.closest('[data-edit-block]');
      if (editButton) {
        const block = findBlock(editButton.dataset.editBlock);
        if (block) openBlockModal(block);
        return;
      }
      const openDay = event.target.closest('[data-open-day]');
      if (openDay) {
        state.anchor = fromDateKey(openDay.dataset.openDay);
        state.selectedDate = openDay.dataset.openDay;
        state.view = 'day';
        localStorage.setItem(VIEW_STORAGE_KEY, state.view);
        await reload();
        return;
      }
      const selectDay = event.target.closest('[data-select-date]');
      if (selectDay) {
        state.selectedDate = selectDay.dataset.selectDate;
        state.anchor = fromDateKey(state.selectedDate);
        render();
      }
    });
    document.getElementById('calDayBody').addEventListener('click', (event) => {
      const editButton = event.target.closest('[data-edit-block]');
      if (!editButton) return;
      const block = findBlock(editButton.dataset.editBlock);
      if (block) openBlockModal(block);
    });
    document.addEventListener('ars:schedule-changed', render);
    document.addEventListener('ars:data-changed', render);
  }

  ARS.Pages.waitReady(async () => {
    if (!ARS.can('schedule.view')) {
      showToast('You do not have schedule access', 'error');
      setTimeout(() => { location.href = '/app/dashboard.html'; }, 500);
      return;
    }
    const params = new URLSearchParams(location.search);
    const requestedView = params.get('view');
    const requestedDate = params.get('date');
    if (VALID_VIEWS.has(requestedView)) {
      state.view = requestedView;
      localStorage.setItem(VIEW_STORAGE_KEY, state.view);
    }
    state.anchor = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate || '')
      ? fromDateKey(requestedDate)
      : new Date();
    state.selectedDate = dateKey(state.anchor);
    document.getElementById('sbType').innerHTML = ARS.SCHEDULE_TYPES
      .filter((type) => type.id !== 'shift')
      .map((type) => `<option value="${type.id}">${esc(type.label)}</option>`)
      .join('');
    populateEmployeeFilter();
    updateSubtitle();
    bindEvents();
    await reload();
    await markScheduleNotificationsRead();
  });
})();
