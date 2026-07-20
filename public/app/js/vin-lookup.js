/* NHTSA vPIC VIN decode — free public API, no key required */
window.ARS = window.ARS || {};

const NHTSA_DECODE = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended';

/** Ordered display fields for the lookup modal */
const VIN_DISPLAY_FIELDS = [
  { key: 'VIN', label: 'VIN' },
  { key: 'ModelYear', label: 'Year' },
  { key: 'Make', label: 'Make' },
  { key: 'Model', label: 'Model' },
  { key: 'Trim', label: 'Trim' },
  { key: 'Series', label: 'Series' },
  { key: 'VehicleType', label: 'Vehicle Type' },
  { key: 'BodyClass', label: 'Body Class' },
  { key: 'DriveType', label: 'Drive Type' },
  { key: 'FuelTypePrimary', label: 'Fuel' },
  { key: 'EngineCylinders', label: 'Cylinders' },
  { key: 'DisplacementL', label: 'Displacement (L)' },
  { key: 'EngineHP', label: 'Horsepower' },
  { key: 'EngineConfiguration', label: 'Engine Config' },
  { key: 'EngineModel', label: 'Engine Model' },
  { key: 'TransmissionStyle', label: 'Transmission' },
  { key: 'GVWR', label: 'GVWR' },
  { key: 'GrossVehicleWeightRatingFrom', label: 'GVWR From' },
  { key: 'GrossVehicleWeightRatingTo', label: 'GVWR To' },
  { key: 'BrakeSystemType', label: 'Brake System' },
  { key: 'ElectrificationLevel', label: 'Electrification' },
  { key: 'PlantCity', label: 'Plant City' },
  { key: 'PlantState', label: 'Plant State' },
  { key: 'PlantCountry', label: 'Plant Country' },
  { key: 'Manufacturer', label: 'Manufacturer' },
  { key: 'PlantCompanyName', label: 'Plant Company' },
  { key: 'ErrorText', label: 'Decode Notes' },
];

function normalizeVin(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
}

function isUseful(val) {
  if (val == null) return false;
  const s = String(val).trim();
  if (!s || s === '0' || /^not applicable$/i.test(s) || /^null$/i.test(s)) return false;
  return true;
}

ARS.VinLookup = {
  _lastResult: null,
  _applyMap: null,

  async decode(vin, modelYear) {
    const clean = normalizeVin(vin);
    if (clean.length < 11) {
      throw new Error('Enter at least 11 characters of a VIN (17 preferred)');
    }
    let url = `${NHTSA_DECODE}/${encodeURIComponent(clean)}?format=json`;
    if (modelYear) url += `&modelyear=${encodeURIComponent(modelYear)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`VIN lookup failed (${res.status})`);
    const data = await res.json();
    const row = data?.Results?.[0];
    if (!row) throw new Error('No decode results returned');
    const errCode = String(row.ErrorCode || '');
    // 0 = success; 1 = VIN decoded with some errors; 8 = incomplete VIN — still usable
    if (errCode && !/^0/.test(errCode) && !errCode.split(',').some((c) => ['0', '1', '8', '11'].includes(c.trim()))) {
      const note = row.ErrorText || 'Could not decode this VIN';
      if (!isUseful(row.Make) && !isUseful(row.Model)) throw new Error(note);
    }
    this._lastResult = { vin: clean, raw: row, decodedAt: new Date().toISOString() };
    return this._lastResult;
  },

  /** Map NHTSA fields into truck form values */
  toTruckFields(result) {
    const r = result?.raw || result;
    if (!r) return {};
    return {
      year: isUseful(r.ModelYear) ? String(r.ModelYear) : '',
      make: isUseful(r.Make) ? String(r.Make) : '',
      model: isUseful(r.Model) ? String(r.Model) : '',
      vin: result?.vin || (isUseful(r.VIN) ? String(r.VIN) : ''),
      bodyClass: isUseful(r.BodyClass) ? String(r.BodyClass) : '',
      vehicleType: isUseful(r.VehicleType) ? String(r.VehicleType) : '',
      fuel: isUseful(r.FuelTypePrimary) ? String(r.FuelTypePrimary) : '',
      driveType: isUseful(r.DriveType) ? String(r.DriveType) : '',
      gvwr: isUseful(r.GVWR) ? String(r.GVWR) : '',
      manufacturer: isUseful(r.Manufacturer) ? String(r.Manufacturer) : '',
    };
  },

  ensureModal() {
    if (document.getElementById('vinLookupModal')) return;
    const el = document.createElement('div');
    el.id = 'vinLookupModal';
    el.className = 'modal-overlay';
    el.innerHTML = `
      <div class="modal" style="max-width:640px;max-height:90vh;display:flex;flex-direction:column">
        <div class="modal__header">
          <div class="modal__title"><i class="fas fa-search" style="margin-right:8px;opacity:.7"></i>VIN Lookup</div>
          <button type="button" class="modal__close" data-vin-close><i class="fas fa-times"></i></button>
        </div>
        <div class="modal__body" style="overflow:auto;flex:1">
          <p style="color:var(--steel);font-size:.82rem;margin:0 0 12px">
            Decodes via NHTSA vPIC (free). Results cover year, make, model, engine, GVWR, and more.
          </p>
          <div class="form-row-2">
            <div class="form-row" style="flex:2">
              <label class="form-label">VIN</label>
              <input class="form-input" id="vinLookupInput" placeholder="17-character VIN" maxlength="17" autocomplete="off" style="font-family:'Courier New',monospace;letter-spacing:.04em;text-transform:uppercase">
            </div>
            <div class="form-row">
              <label class="form-label">Model Year <span style="opacity:.6">(optional)</span></label>
              <input class="form-input" id="vinLookupYear" type="number" placeholder="e.g. 2021" min="1980" max="2099">
            </div>
          </div>
          <div id="vinLookupStatus" style="font-size:.82rem;color:var(--steel);min-height:1.2em;margin-bottom:10px"></div>
          <div id="vinLookupResults" style="display:none"></div>
        </div>
        <div class="modal__footer" style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
          <button type="button" class="btn btn--secondary" data-vin-close>Close</button>
          <button type="button" class="btn btn--secondary" id="vinLookupDecodeBtn"><i class="fas fa-barcode"></i> Decode</button>
          <button type="button" class="btn btn--primary" id="vinLookupApplyBtn" style="display:none"><i class="fas fa-check"></i> Apply to Form</button>
        </div>
      </div>`;
    document.body.appendChild(el);

    el.addEventListener('click', (e) => {
      if (e.target === el || e.target.closest('[data-vin-close]')) this.close();
    });
    document.getElementById('vinLookupDecodeBtn')?.addEventListener('click', () => this.runDecode());
    document.getElementById('vinLookupApplyBtn')?.addEventListener('click', () => this.applyToForm());
    document.getElementById('vinLookupInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.runDecode(); }
    });
  },

  /**
   * @param {object} opts
   * @param {string} [opts.vin]
   * @param {string|number} [opts.year]
   * @param {{ year?: string, make?: string, model?: string, vin?: string }} [opts.applyMap] field element ids
   * @param {boolean} [opts.autoDecode]
   */
  open(opts = {}) {
    this.ensureModal();
    this._applyMap = opts.applyMap || null;
    const input = document.getElementById('vinLookupInput');
    const yearEl = document.getElementById('vinLookupYear');
    const applyBtn = document.getElementById('vinLookupApplyBtn');
    const results = document.getElementById('vinLookupResults');
    const status = document.getElementById('vinLookupStatus');
    if (input) input.value = normalizeVin(opts.vin || '');
    if (yearEl) yearEl.value = opts.year || '';
    if (results) { results.style.display = 'none'; results.innerHTML = ''; }
    if (status) status.textContent = '';
    if (applyBtn) applyBtn.style.display = this._applyMap ? 'inline-flex' : 'none';
    if (typeof openModal === 'function') openModal('vinLookupModal');
    else document.getElementById('vinLookupModal').classList.add('open');
    input?.focus();
    if (opts.autoDecode && normalizeVin(opts.vin).length >= 11) this.runDecode();
  },

  close() {
    if (typeof closeModal === 'function') closeModal('vinLookupModal');
    else document.getElementById('vinLookupModal')?.classList.remove('open');
  },

  async runDecode() {
    const vin = document.getElementById('vinLookupInput')?.value;
    const year = document.getElementById('vinLookupYear')?.value;
    const status = document.getElementById('vinLookupStatus');
    const results = document.getElementById('vinLookupResults');
    const btn = document.getElementById('vinLookupDecodeBtn');
    if (status) status.textContent = 'Looking up…';
    if (results) { results.style.display = 'none'; results.innerHTML = ''; }
    if (btn) btn.disabled = true;
    try {
      const decoded = await this.decode(vin, year || undefined);
      this.renderResults(decoded);
      if (status) status.textContent = 'Decode complete — NHTSA vPIC';
    } catch (err) {
      if (status) status.textContent = err.message || 'Lookup failed';
      if (typeof showToast === 'function') showToast(err.message || 'VIN lookup failed', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  renderResults(decoded) {
    const results = document.getElementById('vinLookupResults');
    if (!results) return;
    const r = decoded.raw;
    const rows = VIN_DISPLAY_FIELDS
      .map(({ key, label }) => {
        const val = r[key];
        if (!isUseful(val)) return '';
        if (key === 'ErrorText' && /^0[,:]?\s*No error/i.test(String(val))) return '';
        return `<div style="display:grid;grid-template-columns:140px 1fr;gap:8px;padding:7px 0;border-bottom:1px solid var(--border,rgba(0,0,0,.08))">
          <div style="color:var(--steel);font-size:.78rem;font-weight:600">${label}</div>
          <div style="font-size:.88rem;word-break:break-word">${String(val)}</div>
        </div>`;
      })
      .filter(Boolean)
      .join('');

    // Extra non-empty fields not in the curated list
    const shown = new Set(VIN_DISPLAY_FIELDS.map((f) => f.key));
    const extras = Object.keys(r)
      .filter((k) => !shown.has(k) && isUseful(r[k]) && !/^(Error|AdditionalError|SuggestedVIN)/i.test(k))
      .sort()
      .slice(0, 40)
      .map((k) => `<div style="display:grid;grid-template-columns:140px 1fr;gap:8px;padding:7px 0;border-bottom:1px solid var(--border,rgba(0,0,0,.08))">
          <div style="color:var(--steel);font-size:.78rem;font-weight:600">${k.replace(/([A-Z])/g, ' $1').trim()}</div>
          <div style="font-size:.88rem;word-break:break-word">${String(r[k])}</div>
        </div>`)
      .join('');

    results.innerHTML = `
      <div style="background:var(--surface-2,rgba(0,0,0,.03));border-radius:8px;padding:12px 14px;margin-bottom:8px">
        <div style="font-weight:700;font-size:1.05rem">${[r.ModelYear, r.Make, r.Model].filter(isUseful).join(' ') || 'Vehicle'}</div>
        <div style="font-family:'Courier New',monospace;font-size:.85rem;color:var(--steel);margin-top:4px">${decoded.vin}</div>
      </div>
      <div>${rows}${extras ? `<details style="margin-top:12px"><summary style="cursor:pointer;font-size:.82rem;color:var(--steel)">More fields</summary>${extras}</details>` : ''}</div>`;
    results.style.display = 'block';
  },

  applyToForm() {
    if (!this._applyMap || !this._lastResult) return;
    const fields = this.toTruckFields(this._lastResult);
    Object.entries(this._applyMap).forEach(([field, elId]) => {
      const el = typeof elId === 'string' ? document.getElementById(elId) : elId;
      if (!el || fields[field] == null || fields[field] === '') return;
      el.value = fields[field];
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    this.close();
    if (typeof showToast === 'function') showToast('Vehicle details applied', 'success');
  },

  /** Wire a Lookup button next to a VIN input */
  attachButton(vinInputId, opts = {}) {
    const input = document.getElementById(vinInputId);
    if (!input || input.dataset.vinLookupWired) return;
    input.dataset.vinLookupWired = '1';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:8px;align-items:stretch';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.style.flex = '1';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--secondary';
    btn.innerHTML = '<i class="fas fa-search"></i> Lookup';
    btn.title = 'Decode VIN via NHTSA';
    btn.addEventListener('click', () => {
      this.open({
        vin: input.value,
        year: opts.yearInputId ? document.getElementById(opts.yearInputId)?.value : '',
        applyMap: opts.applyMap || {
          vin: vinInputId,
          year: opts.yearInputId,
          make: opts.makeInputId,
          model: opts.modelInputId,
        },
        autoDecode: normalizeVin(input.value).length >= 11,
      });
    });
    wrap.appendChild(btn);
  },
};
