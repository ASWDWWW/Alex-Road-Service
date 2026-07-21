/* Staff schedule calendar — blocks + work-order overlays */
window.ARS = window.ARS || {};

ARS.SCHEDULE_TYPES = [
  { id: 'shift', label: 'Scheduled hours', color: '#16a34a' },
  { id: 'meeting', label: 'Meeting', color: '#2563eb' },
  { id: 'lunch', label: 'Lunch', color: '#d97706' },
  { id: 'time_off', label: 'Time off', color: '#64748b' },
  { id: 'training', label: 'Training', color: '#7c3aed' },
  { id: 'shop', label: 'Shop duty', color: '#0f766e' },
  { id: 'other', label: 'Other', color: '#E51F2B' },
];

ARS.Schedule = {
  _unsub: null,
  _blocks: [],
  _range: null,

  isDemo() {
    return !!ARS.isDemoMode?.();
  },

  canManage() {
    return !!ARS.can?.('schedule.manage');
  },

  typeMeta(type) {
    return ARS.SCHEDULE_TYPES.find((t) => t.id === type) || ARS.SCHEDULE_TYPES[ARS.SCHEDULE_TYPES.length - 1];
  },

  async _mods() {
    const cached = window.ARSFirebase?._mods?.firestore;
    if (cached) return cached;
    return import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
  },

  _emit() {
    document.dispatchEvent(new CustomEvent('ars:schedule-changed'));
  },

  monthBounds(year, monthIndex) {
    const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    // Pad to full calendar weeks (Sun–Sat)
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - start.getDay());
    gridStart.setHours(0, 0, 0, 0);
    const gridEnd = new Date(end);
    gridEnd.setDate(end.getDate() + (6 - end.getDay()));
    gridEnd.setHours(23, 59, 59, 999);
    return { start, end, gridStart, gridEnd };
  },

  async listenMonth(year, monthIndex, employeeId = null) {
    const { gridStart, gridEnd } = this.monthBounds(year, monthIndex);
    return this.listenRange(gridStart, gridEnd, employeeId);
  },

  async listenRange(rangeStart, rangeEnd, employeeId = null) {
    const gridStart = new Date(rangeStart);
    const gridEnd = new Date(rangeEnd);
    gridStart.setHours(0, 0, 0, 0);
    gridEnd.setHours(23, 59, 59, 999);
    this._range = { gridStart, gridEnd, employeeId };
    if (this._unsub) {
      this._unsub();
      this._unsub = null;
    }

    if (this.isDemo()) {
      const s = ARS.Store.load();
      this._blocks = (s.scheduleBlocks || []).filter((b) => this._blockInRange(b, gridStart, gridEnd));
      if (employeeId) {
        this._blocks = this._blocks.filter((b) =>
          b.targetAll === true || (b.employeeIds || []).includes(employeeId),
        );
      }
      this._emit();
      return;
    }

    await this._waitFirebase();
    const mod = await this._mods();
    const { collection, query, where, orderBy, onSnapshot } = mod;
    const db = window.ARSFirebase.db;
    const uid = ARS.Auth.getUser()?.uid;
    const manage = this.canManage();
    // Include blocks that began before the visible range but still overlap it.
    const queryStart = new Date(gridStart);
    queryStart.setDate(queryStart.getDate() - 31);
    const startIso = queryStart.toISOString();
    const endIso = gridEnd.toISOString();

    let q;
    if (manage) {
      // Managers always load the month window, then filter client-side so targetAll
      // and multi-assignee blocks stay visible for any selected employee.
      q = query(
        collection(db, 'scheduleBlocks'),
        where('startAt', '>=', startIso),
        where('startAt', '<=', endIso),
        orderBy('startAt', 'asc'),
      );
    } else {
      const target = employeeId || uid;
      // Company-wide pushes also contain every active employee UID.
      q = query(
        collection(db, 'scheduleBlocks'),
        where('employeeIds', 'array-contains', target),
        where('startAt', '>=', startIso),
        where('startAt', '<=', endIso),
        orderBy('startAt', 'asc'),
      );
    }

    this._unsub = onSnapshot(q, (snap) => {
      let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows = rows.filter((b) => this._blockInRange(b, gridStart, gridEnd));
      if (employeeId) {
        rows = rows.filter((b) =>
          b.targetAll === true || (b.employeeIds || []).includes(employeeId),
        );
      }
      rows.sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));
      this._blocks = rows;
      this._emit();
    }, (err) => {
      console.warn('schedule listener:', err.message);
      this._blocks = [];
      this._emit();
    });
  },

  _blockInRange(b, start, end) {
    const s = new Date(b.startAt).getTime();
    const e = new Date(b.endAt || b.startAt).getTime();
    if (isNaN(s)) return false;
    return s <= end.getTime() && (isNaN(e) ? s : e) >= start.getTime();
  },

  async _waitFirebase(maxMs = 4000) {
    const step = 50;
    let n = 0;
    const max = Math.ceil(maxMs / step);
    while (n++ < max) {
      if (window.ARSFirebase?.db) return;
      await new Promise((r) => setTimeout(r, step));
    }
  },

  getBlocks() {
    return this._blocks.slice();
  },

  employeeColor(uid) {
    const palette = ['#15803d', '#0369a1', '#7e22ce', '#b45309', '#be123c', '#0f766e', '#4338ca', '#a21caf'];
    let hash = 0;
    for (const ch of String(uid || 'employee')) hash = ((hash * 31) + ch.charCodeAt(0)) >>> 0;
    return palette[hash % palette.length];
  },

  _scheduleKey(date) {
    return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
  },

  _parseTime(value) {
    const match = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridiem = (match[3] || '').toUpperCase();
    if (minute > 59 || hour > (meridiem ? 12 : 23) || hour < 0) return null;
    if (meridiem === 'PM' && hour !== 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    return { hour, minute };
  },

  _parseShift(value, date) {
    const label = String(value || '').trim();
    if (!label || /^off$/i.test(label)) return null;
    const parts = label.split(/\s*(?:–|—|-|to)\s*/i);
    if (parts.length !== 2) return { label, allDay: true };
    const from = this._parseTime(parts[0]);
    const to = this._parseTime(parts[1]);
    if (!from || !to) return { label, allDay: true };
    const start = new Date(date);
    const end = new Date(date);
    start.setHours(from.hour, from.minute, 0, 0);
    end.setHours(to.hour, to.minute, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1);
    return { label, start, end, allDay: false };
  },

  getShiftEvents(date, employeeId = null) {
    const day = new Date(date);
    const key = this._scheduleKey(day);
    let employees = ARS.Data.listEmployees()
      .filter((e) => e.active !== false && e.status !== 'Archived' && e.status !== 'Terminated');
    if (employeeId) employees = employees.filter((e) => e.uid === employeeId || e.id === employeeId);
    return employees.map((employee) => {
      const shift = this._parseShift(employee.schedule?.[key], day);
      if (!shift) return null;
      const start = shift.start || new Date(day.setHours(0, 0, 0, 0));
      const end = shift.end || new Date(new Date(date).setHours(23, 59, 59, 999));
      const uid = employee.uid || employee.id;
      return {
        id: `shift_${uid}_${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`,
        source: 'shift',
        type: 'shift',
        title: employeeId ? `Scheduled · ${shift.label}` : `${employee.name} · ${shift.label}`,
        shiftLabel: shift.label,
        color: this.employeeColor(uid),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        allDay: shift.allDay,
        employeeIds: [uid],
        employeeNames: { [uid]: employee.name },
        readOnly: true,
      };
    }).filter(Boolean);
  },

  /** Work orders as calendar events for an employee (or all if null and manage) */
  getWorkOrderEvents(employeeId, rangeStart, rangeEnd) {
    let wos = ARS.Data.listWorkOrders();
    if (employeeId) {
      wos = wos.filter((w) => ARS.Data.getWoTechs(w).some((t) => t.uid === employeeId || t.name === ARS.Data.getEmployee?.(employeeId)?.name));
    }
    return wos.map((w) => {
      const day = this._parseWoDate(w.date);
      if (!day) return null;
      if (day < rangeStart || day > rangeEnd) return null;
      const start = new Date(day);
      start.setHours(8, 0, 0, 0);
      const end = new Date(day);
      end.setHours(16, 30, 0, 0);
      return {
        id: `wo_${w.id}`,
        source: 'workOrder',
        workOrderId: w.id,
        title: `${w.id} · ${w.customerName || 'Job'}`,
        type: 'work_order',
        color: '#171A1A',
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        allDay: false,
        status: w.status,
        desc: w.desc || '',
        employeeIds: ARS.Data.getWoTechs(w).map((t) => t.uid).filter(Boolean),
        readOnly: true,
      };
    }).filter(Boolean);
  },

  _parseWoDate(dateLike) {
    if (!dateLike) return null;
    const dateOnly = String(dateLike).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12, 0, 0, 0);
    }
    const d = new Date(dateLike);
    if (!isNaN(d)) {
      d.setHours(12, 0, 0, 0);
      return d;
    }
    // Already formatted "Mon DD, YYYY"
    const t = Date.parse(dateLike);
    if (!isNaN(t)) {
      const x = new Date(t);
      x.setHours(12, 0, 0, 0);
      return x;
    }
    return null;
  },

  eventsForDay(date, employeeId = null) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const blocks = this.getBlocks()
      .filter((b) => this._blockInRange(b, dayStart, dayEnd))
      .filter((b) => !employeeId || b.targetAll === true || (b.employeeIds || []).includes(employeeId))
      .map((b) => ({
        ...b,
        source: 'block',
        color: b.color || this.typeMeta(b.type).color,
        readOnly: false,
      }));
    const { gridStart, gridEnd } = this._range || this.monthBounds(dayStart.getFullYear(), dayStart.getMonth());
    const wos = this.getWorkOrderEvents(employeeId, gridStart, gridEnd)
      .filter((e) => this._blockInRange(e, dayStart, dayEnd));
    const shifts = this.getShiftEvents(dayStart, employeeId);
    return [...shifts, ...blocks, ...wos].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  },

  eventsForMonth(year, monthIndex, employeeId = null) {
    const { gridStart, gridEnd } = this.monthBounds(year, monthIndex);
    const map = {};
    for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
      const key = ARS.toInputDate(d);
      map[key] = this.eventsForDay(new Date(d), employeeId);
    }
    return map;
  },

  activeEmployeeIds() {
    if (ARS.Data?.listEmployees) {
      return ARS.Data.listEmployees()
        .filter((e) => e.active !== false && e.status !== 'Archived' && e.status !== 'Terminated')
        .map((e) => e.uid);
    }
    return (ARS.Messaging?.getAllRoster?.() || [])
      .filter((r) => r.active !== false)
      .map((r) => r.uid);
  },

  async createBlock(payload) {
    const user = ARS.Auth.getUser();
    if (!user?.uid) throw new Error('Not signed in');

    let employeeIds = Array.isArray(payload.employeeIds) ? [...new Set(payload.employeeIds.filter(Boolean))] : [];
    if (payload.targetAll) {
      if (!this.canManage()) throw new Error('Only managers can assign to all staff');
      employeeIds = this.activeEmployeeIds();
    }
    if (!employeeIds.length || employeeIds.length > 100) {
      throw new Error('Select between 1 and 100 employees');
    }

    if (!this.canManage()) {
      if (employeeIds.length !== 1 || employeeIds[0] !== user.uid) {
        throw new Error('You can only add blocks for yourself');
      }
    }

    const title = String(payload.title || '').trim();
    if (!title || title.length > 80) throw new Error('Title must be 1–80 characters');
    const type = payload.type || 'other';
    const validTypes = ARS.SCHEDULE_TYPES
      .filter((entry) => entry.id !== 'shift')
      .map((entry) => entry.id);
    if (!validTypes.includes(type)) throw new Error('Select a valid block type');
    const notes = String(payload.notes || '').trim();
    if (notes.length > 1000) throw new Error('Notes must be 1,000 characters or less');
    const startAt = new Date(payload.startAt);
    const endAt = new Date(payload.endAt);
    if (isNaN(startAt) || isNaN(endAt)) throw new Error('Valid start and end required');
    if (endAt <= startAt) throw new Error('End must be after start');

    const block = {
      title,
      type,
      color: payload.color || this.typeMeta(type).color,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      allDay: !!payload.allDay,
      notes,
      employeeIds,
      employeeNames: this._namesFor(employeeIds),
      targetAll: !!payload.targetAll,
      createdBy: user.uid,
      createdByName: user.name || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (this.isDemo()) {
      const s = ARS.Store.load();
      const id = 'sb_' + Date.now().toString(36);
      const row = { id, ...block };
      s.scheduleBlocks = [...(s.scheduleBlocks || []), row];
      ARS.Store.save(s);
      this._blocks = [...this._blocks, row];
      this._emit();
      return row;
    }

    const { collection, addDoc } = await this._mods();
    const ref = await addDoc(collection(window.ARSFirebase.db, 'scheduleBlocks'), block);
    return { id: ref.id, ...block };
  },

  async updateBlock(id, patch) {
    const user = ARS.Auth.getUser();
    if (!user?.uid) throw new Error('Not signed in');
    const existing = this._blocks.find((b) => b.id === id);
    if (!existing && !this.isDemo()) {
      // still allow update by id
    }
    if (!this.canManage() && existing?.createdBy !== user.uid) {
      throw new Error('Permission denied');
    }

    let employeeIds = patch.employeeIds;
    if (patch.targetAll) {
      if (!this.canManage()) throw new Error('Only managers can assign to all staff');
      employeeIds = this.activeEmployeeIds();
    }
    const next = { ...patch, updatedAt: new Date().toISOString() };
    if (employeeIds) {
      next.employeeIds = [...new Set(employeeIds.filter(Boolean))];
      next.employeeNames = this._namesFor(next.employeeIds);
    }
    if (next.startAt) next.startAt = new Date(next.startAt).toISOString();
    if (next.endAt) next.endAt = new Date(next.endAt).toISOString();
    if (next.type && !next.color) next.color = this.typeMeta(next.type).color;

    const merged = { ...(existing || {}), ...next };
    const title = String(merged.title || '').trim();
    const notes = String(merged.notes || '').trim();
    const validTypes = ARS.SCHEDULE_TYPES
      .filter((entry) => entry.id !== 'shift')
      .map((entry) => entry.id);
    const startAt = new Date(merged.startAt);
    const endAt = new Date(merged.endAt);
    if (!title || title.length > 80) throw new Error('Title must be 1–80 characters');
    if (!validTypes.includes(merged.type)) throw new Error('Select a valid block type');
    if (notes.length > 1000) throw new Error('Notes must be 1,000 characters or less');
    if (isNaN(startAt) || isNaN(endAt) || endAt <= startAt) {
      throw new Error('End must be after start');
    }
    if (!Array.isArray(merged.employeeIds) || !merged.employeeIds.length || merged.employeeIds.length > 100) {
      throw new Error('Select between 1 and 100 employees');
    }
    next.title = title;
    next.notes = notes;

    if (this.isDemo()) {
      const s = ARS.Store.load();
      const i = (s.scheduleBlocks || []).findIndex((b) => b.id === id);
      if (i < 0) throw new Error('Block not found');
      s.scheduleBlocks[i] = { ...s.scheduleBlocks[i], ...next };
      ARS.Store.save(s);
      this._blocks = s.scheduleBlocks.filter((b) => this._range ? this._blockInRange(b, this._range.gridStart, this._range.gridEnd) : true);
      this._emit();
      return s.scheduleBlocks[i];
    }

    const { doc, updateDoc } = await this._mods();
    await updateDoc(doc(window.ARSFirebase.db, 'scheduleBlocks', id), next);
    return { id, ...existing, ...next };
  },

  async deleteBlock(id) {
    const user = ARS.Auth.getUser();
    const existing = this._blocks.find((b) => b.id === id);
    if (!this.canManage() && existing?.createdBy !== user?.uid) {
      throw new Error('Permission denied');
    }
    if (this.isDemo()) {
      const s = ARS.Store.load();
      s.scheduleBlocks = (s.scheduleBlocks || []).filter((b) => b.id !== id);
      ARS.Store.save(s);
      this._blocks = this._blocks.filter((b) => b.id !== id);
      this._emit();
      return;
    }
    const { doc, deleteDoc } = await this._mods();
    await deleteDoc(doc(window.ARSFirebase.db, 'scheduleBlocks', id));
  },

  _namesFor(ids) {
    const names = {};
    ids.forEach((uid) => {
      const emp = ARS.Data?.getEmployee?.(uid);
      const roster = ARS.Messaging?.getAllRoster?.()?.find((r) => r.uid === uid);
      names[uid] = emp?.name || roster?.name || uid;
    });
    return names;
  },

  destroy() {
    if (this._unsub) this._unsub();
    this._unsub = null;
    this._blocks = [];
  },
};
