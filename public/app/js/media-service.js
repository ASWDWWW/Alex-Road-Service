/* Firebase Storage media — upload / delete / entity persistence */
window.ARS = window.ARS || {};

const MEDIA_ENTITY_MAP = {
  workOrders: { collection: 'workOrders', update: 'updateWorkOrder', store: 'workOrders' },
  trucks: { collection: 'trucks', update: 'updateTruck', store: 'trucks' },
  estimates: { collection: 'estimates', update: 'updateEstimate', store: 'estimates' },
  leads: { collection: 'contact_submissions', update: 'updateContactSubmission', store: 'contactSubmissions' },
  invoices: { collection: 'invoices', update: 'updateInvoice', store: 'invoices' },
  inventory: { collection: 'inventory', update: 'updatePart', store: 'inventory' },
  customers: { collection: 'customers', update: 'updateCustomer', store: 'customers' },
  employees: { collection: 'users', update: 'updateEmployee', store: 'employees' },
};

const TAGS = {
  workOrders: [
    { id: 'before', label: 'Before' },
    { id: 'during', label: 'During' },
    { id: 'after', label: 'After' },
    { id: 'damage', label: 'Damage' },
    { id: 'parts', label: 'Parts' },
    { id: 'video', label: 'Video' },
    { id: 'other', label: 'Other' },
  ],
  trucks: [
    { id: 'unit', label: 'Unit' },
    { id: 'vin', label: 'VIN plate' },
    { id: 'overall', label: 'Overall' },
    { id: 'damage', label: 'Damage' },
    { id: 'other', label: 'Other' },
  ],
  estimates: [
    { id: 'problem', label: 'Problem' },
    { id: 'damage', label: 'Damage' },
    { id: 'video', label: 'Video' },
    { id: 'other', label: 'Other' },
  ],
  leads: [
    { id: 'breakdown', label: 'Breakdown' },
    { id: 'video', label: 'Video' },
    { id: 'other', label: 'Other' },
  ],
  invoices: [
    { id: 'receipt', label: 'Receipt' },
    { id: 'check', label: 'Check' },
    { id: 'terminal', label: 'Terminal slip' },
    { id: 'other', label: 'Other' },
  ],
  inventory: [
    { id: 'catalog', label: 'Catalog' },
    { id: 'shelf', label: 'Shelf' },
    { id: 'other', label: 'Other' },
  ],
  customers: [
    { id: 'logo', label: 'Logo' },
    { id: 'account', label: 'Account' },
    { id: 'other', label: 'Other' },
  ],
  employees: [
    { id: 'i9', label: 'I-9' },
    { id: 'w4', label: 'W-4' },
    { id: 'id', label: 'ID / License' },
    { id: 'certification', label: 'Certification' },
    { id: 'other', label: 'Other' },
  ],
};

ARS.Media = {
  MAX_IMAGE: 10 * 1024 * 1024,
  MAX_VIDEO: 50 * 1024 * 1024,
  MAX_PDF: 10 * 1024 * 1024,
  ACCEPT_DEFAULT: 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm',
  ACCEPT_INVOICE: 'image/jpeg,image/png,image/webp,image/gif,application/pdf',
  ACCEPT_IMAGE: 'image/jpeg,image/png,image/webp,image/gif',

  tagsFor(entityType) {
    return TAGS[entityType] || [{ id: 'other', label: 'Other' }];
  },

  acceptFor(entityType) {
    if (entityType === 'invoices' || entityType === 'employees') return this.ACCEPT_INVOICE;
    if (entityType === 'inventory' || entityType === 'customers' || entityType === 'settings' || entityType === 'avatar') {
      return this.ACCEPT_IMAGE;
    }
    return this.ACCEPT_DEFAULT;
  },

  canView(entityType) {
    if (ARS.isDemoMode?.()) return true;
    const role = ARS.Auth?.getRole?.();
    if (['admin', 'developer', 'demo'].includes(role)) return true;
    if (entityType === 'employees') return ARS.can('employees.view');
    if (entityType === 'leads' || entityType === 'invoices' || entityType === 'customers') {
      return role === 'office';
    }
    return ['office', 'technician'].includes(role);
  },

  canUpload(entityType, entity) {
    if (!this.canView(entityType) && entityType !== 'avatar' && entityType !== 'settings' && entityType !== 'employees') return false;
    if (ARS.isDemoMode?.()) return true;
    const role = ARS.Auth?.getRole?.();
    if (entityType === 'settings') return ARS.can('settings.edit');
    if (entityType === 'avatar') return !!ARS.Auth?.getUser?.()?.uid;
    if (entityType === 'employees') {
      return ARS.can('employees.manage') || ARS.Auth?.getUser?.()?.uid === (entity?.uid || entity?.id);
    }
    if (entityType === 'workOrders') {
      if (ARS.can('workOrders.editAll')) return true;
      if (role === 'technician' && entity) {
        return ARS.Data?.woAssignedToUser?.(entity) || ARS.Auth.getUser()?.name === entity.tech;
      }
      return false;
    }
    if (entityType === 'trucks') {
      return ARS.can('trucks.edit') || role === 'technician';
    }
    if (entityType === 'estimates') return ARS.can('estimates.create');
    if (entityType === 'leads') return ARS.canAccessLeads?.();
    if (entityType === 'invoices') return ARS.can('invoices.edit');
    if (entityType === 'inventory') return ARS.can('inventory.edit');
    if (entityType === 'customers') return ARS.can('customers.edit');
    return false;
  },

  canDelete(entityType, entity) {
    if (entityType === 'avatar') return this.canUpload(entityType);
    if (entityType === 'settings') return ARS.can('settings.edit');
    if (entityType === 'employees') return ARS.can('employees.manage');
    if (entityType === 'workOrders' && ARS.Auth?.getRole?.() === 'technician') {
      return this.canUpload(entityType, entity);
    }
    return this.canUpload(entityType, entity) && ARS.Auth?.getRole?.() !== 'technician'
      ? true
      : this.canUpload(entityType, entity);
  },

  _safeName(name) {
    return String(name || 'file').replace(/[^\w.\-]+/g, '_').slice(0, 80);
  },

  _validate(file, entityType) {
    if (!file) throw new Error('No file selected');
    const type = file.type || '';
    const isImg = type.startsWith('image/');
    const isVid = type.startsWith('video/');
    const isPdf = type === 'application/pdf';
    if (entityType === 'invoices' || entityType === 'employees') {
      if (!isImg && !isPdf) throw new Error('Use an image or PDF');
    } else if (entityType === 'inventory' || entityType === 'customers' || entityType === 'settings' || entityType === 'avatar') {
      if (!isImg) throw new Error('Images only');
    } else if (!isImg && !isVid) {
      throw new Error('Images or videos only');
    }
    if (isImg && file.size > this.MAX_IMAGE) throw new Error('Image must be under 10 MB');
    if (isVid && file.size > this.MAX_VIDEO) throw new Error('Video must be under 50 MB');
    if (isPdf && file.size > this.MAX_PDF) throw new Error('PDF must be under 10 MB');
  },

  async _ensureStorage() {
    if (ARS.isDemoMode?.()) return null;
    if (!window.ARSFirebase?.configured) throw new Error('Firebase not configured');
    if (window.ARSFirebase.storage) return window.ARSFirebase.storage;
    const { getStorage } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
    window.ARSFirebase.storage = getStorage(window.ARSFirebase.app);
    if (!window.ARSFirebase._mods) window.ARSFirebase._mods = {};
    window.ARSFirebase._mods.storage = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
    return window.ARSFirebase.storage;
  },

  async _storageMods() {
    if (window.ARSFirebase?._mods?.storage) return window.ARSFirebase._mods.storage;
    const mod = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
    if (window.ARSFirebase) {
      window.ARSFirebase._mods = window.ARSFirebase._mods || {};
      window.ARSFirebase._mods.storage = mod;
    }
    return mod;
  },

  _path(entityType, entityId, fileId, fileName) {
    if (entityType === 'settings') return `media/settings/logo/${fileId}_${this._safeName(fileName)}`;
    if (entityType === 'avatar') return `media/users/${entityId}/avatar/${fileId}_${this._safeName(fileName)}`;
    if (entityType === 'employees') return `media/users/${entityId}/docs/${fileId}_${this._safeName(fileName)}`;
    if (entityType === 'public_leads') return `media/public_leads/${entityId}/${fileId}_${this._safeName(fileName)}`;
    return `media/${entityType}/${entityId}/${fileId}_${this._safeName(fileName)}`;
  },

  async _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  async _compressImageDemo(file) {
    if (!file.type.startsWith('image/')) return this._fileToDataUrl(file);
    const bitmap = await createImageBitmap(file);
    const max = 1280;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return canvas.toDataURL('image/jpeg', 0.82);
  },

  async upload({ entityType, entityId, file, tag = 'other', onProgress }) {
    this._validate(file, entityType);
    const fileId = ARS.uid().replace(/^id_/, '');
    const user = ARS.Auth?.getUser?.();
    const base = {
      id: fileId,
      name: file.name,
      contentType: file.type,
      size: file.size,
      tag: tag || 'other',
      uploadedBy: user?.uid || user?.email || 'public',
      uploadedByName: user?.name || 'Public',
      uploadedAt: new Date().toISOString(),
    };

    if (ARS.isDemoMode?.()) {
      if (file.type.startsWith('video/') && file.size > 8 * 1024 * 1024) {
        throw new Error('Demo mode: keep videos under 8 MB (or use live Firebase)');
      }
      const url = file.type.startsWith('image/')
        ? await this._compressImageDemo(file)
        : await this._fileToDataUrl(file);
      onProgress?.(100);
      return { ...base, path: `demo/${entityType}/${entityId}/${fileId}`, url, demo: true };
    }

    await this._ensureStorage();
    const mods = await this._storageMods();
    const { ref, uploadBytesResumable, getDownloadURL } = mods;
    const path = this._path(entityType, entityId, fileId, file.name);
    const storageRef = ref(window.ARSFirebase.storage, path);

    const url = await new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
      task.on('state_changed', (snap) => {
        const pct = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
        onProgress?.(pct);
      }, reject, async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (e) {
          reject(e);
        }
      });
    });

    return { ...base, path, url };
  },

  async uploadPublicLead(file, uploadSessionId) {
    this._validate(file, 'leads');
    const sessionId = uploadSessionId || ARS.uid().replace(/^id_/, 'lead');
    return this.upload({
      entityType: 'public_leads',
      entityId: sessionId,
      file,
      tag: file.type.startsWith('video/') ? 'video' : 'breakdown',
    });
  },

  async deleteItem(mediaItem) {
    if (!mediaItem) return;
    if (mediaItem.demo || ARS.isDemoMode?.() || String(mediaItem.path || '').startsWith('demo/')) {
      return;
    }
    if (!mediaItem.path) return;
    await this._ensureStorage();
    const mods = await this._storageMods();
    const { ref, deleteObject } = mods;
    try {
      await deleteObject(ref(window.ARSFirebase.storage, mediaItem.path));
    } catch (e) {
      if (!String(e?.code || e?.message || '').includes('object-not-found')) {
        throw e;
      }
    }
  },

  async saveEntityMedia(entityType, entityId, media) {
    const map = MEDIA_ENTITY_MAP[entityType];
    if (!map) throw new Error('Unknown entity type');
    const fn = ARS.Data?.[map.update];
    if (!fn) throw new Error(`No updater for ${entityType}`);
    return fn.call(ARS.Data, entityId, { media });
  },

  async addToEntity(entityType, entityId, mediaItem) {
    const entity = this.getEntity(entityType, entityId);
    const media = [...(entity?.media || []), mediaItem];
    await this.saveEntityMedia(entityType, entityId, media);
    return media;
  },

  async removeFromEntity(entityType, entityId, mediaId) {
    const entity = this.getEntity(entityType, entityId);
    const target = (entity?.media || []).find((m) => m.id === mediaId);
    const media = (entity?.media || []).filter((m) => m.id !== mediaId);
    await this.deleteItem(target);
    await this.saveEntityMedia(entityType, entityId, media);
    return media;
  },

  getEntity(entityType, entityId) {
    if (entityType === 'workOrders') return ARS.Data.getWorkOrder?.(entityId);
    if (entityType === 'trucks') return ARS.Data.getTruck?.(entityId);
    if (entityType === 'estimates') return ARS.Data.getEstimate?.(entityId);
    if (entityType === 'invoices') return ARS.Data.getInvoice?.(entityId);
    if (entityType === 'customers') return ARS.Data.getCustomer?.(entityId);
    if (entityType === 'inventory') return ARS.Data.listInventory?.().find((p) => p.id === entityId);
    if (entityType === 'leads') {
      return ARS.Data.listContactSubmissions?.().find((l) => l.id === entityId);
    }
    if (entityType === 'employees') return ARS.Data.getEmployee?.(entityId);
    return null;
  },

  /** Copy media metadata (same Storage objects) onto another entity */
  async copyMediaTo(fromType, fromId, toType, toId, { tags } = {}) {
    const from = this.getEntity(fromType, fromId);
    let items = from?.media || [];
    if (tags?.length) items = items.filter((m) => tags.includes(m.tag));
    if (!items.length) return [];
    const to = this.getEntity(toType, toId);
    const merged = [...(to?.media || [])];
    items.forEach((m) => {
      if (!merged.some((x) => x.path === m.path || x.id === m.id)) {
        merged.push({
          ...m,
          id: ARS.uid().replace(/^id_/, ''),
          copiedFrom: `${fromType}/${fromId}`,
          uploadedAt: new Date().toISOString(),
        });
      }
    });
    await this.saveEntityMedia(toType, toId, merged);
    return merged;
  },
};
