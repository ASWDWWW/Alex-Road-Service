/* Shared media gallery + lightbox UI */
window.ARS = window.ARS || {};

ARS.MediaUI = {
  _lightboxBound: false,

  ensureLightbox() {
    if (document.getElementById('arsMediaLightbox')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="media-lightbox" id="arsMediaLightbox" hidden>
        <button type="button" class="media-lightbox__close" aria-label="Close"><i class="fas fa-times"></i></button>
        <div class="media-lightbox__body" id="arsMediaLightboxBody"></div>
        <div class="media-lightbox__caption" id="arsMediaLightboxCaption"></div>
      </div>`);
    const box = document.getElementById('arsMediaLightbox');
    box.querySelector('.media-lightbox__close').addEventListener('click', () => this.closeLightbox());
    box.addEventListener('click', (e) => { if (e.target === box) this.closeLightbox(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !box.hidden) this.closeLightbox();
    });
  },

  openLightbox(item) {
    this.ensureLightbox();
    const box = document.getElementById('arsMediaLightbox');
    const body = document.getElementById('arsMediaLightboxBody');
    const cap = document.getElementById('arsMediaLightboxCaption');
    const isVid = (item.contentType || '').startsWith('video/');
    const isPdf = item.contentType === 'application/pdf';
    if (isVid) {
      body.innerHTML = `<video src="${item.url}" controls autoplay playsinline style="max-width:100%;max-height:80vh"></video>`;
    } else if (isPdf) {
      body.innerHTML = `<iframe src="${item.url}" title="${item.name || 'PDF'}" style="width:min(900px,94vw);height:80vh;border:0;background:#fff"></iframe>`;
    } else {
      body.innerHTML = `<img src="${item.url}" alt="${item.name || ''}">`;
    }
    cap.textContent = [item.tag, item.name, item.uploadedByName].filter(Boolean).join(' · ');
    box.hidden = false;
  },

  closeLightbox() {
    const box = document.getElementById('arsMediaLightbox');
    if (!box) return;
    box.hidden = true;
    document.getElementById('arsMediaLightboxBody').innerHTML = '';
  },

  /**
   * Mount a gallery into `el`.
   * opts: { entityType, entityId, title, getEntity, emptyText }
   */
  mount(el, opts) {
    if (!el || !opts?.entityType || !opts?.entityId) return null;
    const state = {
      entityType: opts.entityType,
      entityId: opts.entityId,
      title: opts.title || 'Photos & videos',
      tag: opts.defaultTag || 'other',
      uploading: false,
    };

    const refresh = () => {
      const entity = opts.getEntity
        ? opts.getEntity()
        : ARS.Media.getEntity(state.entityType, state.entityId);
      const media = [...(entity?.media || [])].sort(
        (a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
      );
      const canUp = ARS.Media.canUpload(state.entityType, entity);
      const canDel = ARS.Media.canDelete(state.entityType, entity);
      const tags = ARS.Media.tagsFor(state.entityType);
      const accept = ARS.Media.acceptFor(state.entityType);

      el.innerHTML = `
        <div class="media-gallery" data-media-root>
          <div class="media-gallery__header">
            <div class="media-gallery__title"><i class="fas fa-camera"></i> ${state.title}</div>
            <div class="media-gallery__count">${media.length} file${media.length === 1 ? '' : 's'}</div>
          </div>
          ${canUp ? `
          <div class="media-gallery__upload">
            <select class="form-select media-gallery__tag" data-media-tag>
              ${tags.map((t) => `<option value="${t.id}"${t.id === state.tag ? ' selected' : ''}>${t.label}</option>`).join('')}
            </select>
            <label class="btn btn--secondary btn--sm media-gallery__pick">
              <i class="fas fa-cloud-upload-alt"></i> Add files
              <input type="file" accept="${accept}" multiple hidden data-media-input>
            </label>
          </div>
          <div class="media-gallery__progress" data-media-progress hidden>
            <div class="media-gallery__progress-bar" data-media-progress-bar></div>
            <span data-media-progress-text>Uploading…</span>
          </div>` : ''}
          <div class="media-gallery__grid" data-media-grid>
            ${media.length ? media.map((m) => this._tile(m, canDel)).join('') : `
              <div class="media-gallery__empty">${opts.emptyText || 'No photos or videos yet.'}</div>`}
          </div>
        </div>`;

      el.querySelector('[data-media-tag]')?.addEventListener('change', (e) => {
        state.tag = e.target.value;
      });

      el.querySelector('[data-media-input]')?.addEventListener('change', async (e) => {
        const files = [...(e.target.files || [])];
        e.target.value = '';
        if (!files.length || state.uploading) return;
        await this._uploadFiles(state, files, refresh, opts);
      });

      el.querySelector('[data-media-grid]')?.addEventListener('click', async (e) => {
        const openBtn = e.target.closest('[data-media-open]');
        if (openBtn) {
          const item = media.find((m) => m.id === openBtn.dataset.mediaOpen);
          if (item) this.openLightbox(item);
          return;
        }
        const delBtn = e.target.closest('[data-media-del]');
        if (!delBtn) return;
        const id = delBtn.dataset.mediaDel;
        const ok = ARS.Pages?.confirmAsync
          ? await ARS.Pages.confirmAsync({ title: 'Delete media', message: 'Remove this file?', okLabel: 'Delete' })
          : confirm('Remove this file?');
        if (!ok) return;
        try {
          await ARS.Media.removeFromEntity(state.entityType, state.entityId, id);
          showToast('Media removed', 'success');
          refresh();
          opts.onChanged?.();
        } catch (err) {
          showToast(err.message || 'Delete failed', 'error');
        }
      });
    };

    refresh();
    return { refresh };
  },

  _tile(m, canDel) {
    const isVid = (m.contentType || '').startsWith('video/');
    const isPdf = m.contentType === 'application/pdf';
    const tag = m.tag || 'other';
    let thumb;
    if (isVid) {
      thumb = `<div class="media-tile__thumb media-tile__thumb--video"><i class="fas fa-play-circle"></i></div>`;
    } else if (isPdf) {
      thumb = `<div class="media-tile__thumb media-tile__thumb--pdf"><i class="fas fa-file-pdf"></i></div>`;
    } else {
      thumb = `<div class="media-tile__thumb" style="background-image:url('${m.url}')"></div>`;
    }
    return `
      <div class="media-tile">
        <button type="button" class="media-tile__open" data-media-open="${m.id}" title="View">${thumb}</button>
        <div class="media-tile__meta">
          <span class="media-tile__tag">${tag}</span>
          <span class="media-tile__name" title="${m.name || ''}">${m.name || 'file'}</span>
        </div>
        ${canDel ? `<button type="button" class="media-tile__del" data-media-del="${m.id}" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
      </div>`;
  },

  async _uploadFiles(state, files, refresh, opts) {
    state.uploading = true;
    const progress = document.querySelector(`[data-media-root] [data-media-progress]`);
    const bar = document.querySelector(`[data-media-root] [data-media-progress-bar]`);
    const text = document.querySelector(`[data-media-root] [data-media-progress-text]`);
    if (progress) progress.hidden = false;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (text) text.textContent = `Uploading ${i + 1}/${files.length}: ${file.name}`;
        const item = await ARS.Media.upload({
          entityType: state.entityType,
          entityId: state.entityId,
          file,
          tag: state.tag,
          onProgress: (pct) => {
            if (bar) bar.style.backgroundSize = `${pct}% 100%`;
          },
        });
        await ARS.Media.addToEntity(state.entityType, state.entityId, item);
      }
      showToast(files.length === 1 ? 'File uploaded' : `${files.length} files uploaded`, 'success');
      refresh();
      opts.onChanged?.();
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      state.uploading = false;
      if (progress) progress.hidden = true;
      if (bar) bar.style.backgroundSize = '0% 100%';
    }
  },

  /** Compact uploader for public contact form (returns pending media array) */
  mountPublicLeadUploader(el, { sessionId, onChange } = {}) {
    if (!el) return { getMedia: () => [] };
    const sid = sessionId || ARS.uid().replace(/^id_/, 'lead');
    const pending = [];
    el.innerHTML = `
      <div class="media-gallery media-gallery--public">
        <div class="media-gallery__header">
          <div class="media-gallery__title"><i class="fas fa-camera"></i> Photos / video of the issue</div>
          <div class="media-gallery__count" data-pl-count>Optional</div>
        </div>
        <label class="btn btn--secondary btn--sm" style="align-self:flex-start">
          <i class="fas fa-plus"></i> Add media
          <input type="file" accept="${ARS.Media.ACCEPT_DEFAULT}" multiple hidden data-pl-input>
        </label>
        <div class="media-gallery__progress" data-pl-progress hidden>
          <div class="media-gallery__progress-bar" data-pl-bar></div>
          <span data-pl-text>Uploading…</span>
        </div>
        <div class="media-gallery__grid" data-pl-grid></div>
      </div>`;

    const renderPending = () => {
      const grid = el.querySelector('[data-pl-grid]');
      const count = el.querySelector('[data-pl-count]');
      count.textContent = pending.length ? `${pending.length} file${pending.length === 1 ? '' : 's'}` : 'Optional';
      grid.innerHTML = pending.map((m) => `
        <div class="media-tile">
          <button type="button" class="media-tile__open" data-pl-open="${m.id}">
            ${(m.contentType || '').startsWith('video/')
              ? '<div class="media-tile__thumb media-tile__thumb--video"><i class="fas fa-play-circle"></i></div>'
              : `<div class="media-tile__thumb" style="background-image:url('${m.url}')"></div>`}
          </button>
          <div class="media-tile__meta"><span class="media-tile__tag">${m.tag}</span></div>
          <button type="button" class="media-tile__del" data-pl-del="${m.id}"><i class="fas fa-trash"></i></button>
        </div>`).join('');
      onChange?.(pending);
    };

    el.querySelector('[data-pl-input]').addEventListener('change', async (e) => {
      const files = [...(e.target.files || [])];
      e.target.value = '';
      const progress = el.querySelector('[data-pl-progress]');
      const bar = el.querySelector('[data-pl-bar]');
      const text = el.querySelector('[data-pl-text]');
      progress.hidden = false;
      try {
        for (let i = 0; i < files.length; i++) {
          text.textContent = `Uploading ${i + 1}/${files.length}`;
          const item = await ARS.Media.uploadPublicLead(files[i], sid);
          pending.push(item);
          renderPending();
        }
      } catch (err) {
        showToast?.(err.message || 'Upload failed', 'error') || alert(err.message || 'Upload failed');
      } finally {
        progress.hidden = true;
        bar.style.backgroundSize = '0% 100%';
      }
    });

    el.addEventListener('click', (e) => {
      const open = e.target.closest('[data-pl-open]');
      if (open) {
        const item = pending.find((m) => m.id === open.dataset.plOpen);
        if (item) this.openLightbox(item);
        return;
      }
      const del = e.target.closest('[data-pl-del]');
      if (!del) return;
      const idx = pending.findIndex((m) => m.id === del.dataset.plDel);
      if (idx >= 0) {
        const [removed] = pending.splice(idx, 1);
        ARS.Media.deleteItem(removed).catch(() => {});
        renderPending();
      }
    });

    return {
      sessionId: sid,
      getMedia: () => [...pending],
      clear: () => { pending.length = 0; renderPending(); },
    };
  },

  /** Single image picker for logo / avatar */
  mountSingleImage(el, {
    title = 'Image',
    currentUrl = '',
    entityType,
    entityId,
    onUploaded,
    onCleared,
    canEdit = true,
  } = {}) {
    if (!el) return;
    const render = (url) => {
      el.innerHTML = `
        <div class="media-single">
          <div class="media-single__preview" style="${url ? `background-image:url('${url}')` : ''}">
            ${url ? '' : '<i class="fas fa-image"></i>'}
          </div>
          <div class="media-single__actions">
            <div class="media-single__title">${title}</div>
            ${canEdit ? `
              <label class="btn btn--secondary btn--sm">
                <i class="fas fa-upload"></i> ${url ? 'Replace' : 'Upload'}
                <input type="file" accept="${ARS.Media.ACCEPT_IMAGE}" hidden data-single-input>
              </label>
              ${url && onCleared ? `<button type="button" class="btn btn--ghost btn--sm" data-single-clear>Remove</button>` : ''}
            ` : ''}
          </div>
        </div>`;
      el.querySelector('[data-single-input]')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
          const item = await ARS.Media.upload({ entityType, entityId, file, tag: 'logo' });
          await onUploaded?.(item);
          render(item.url);
          showToast('Image saved', 'success');
        } catch (err) {
          showToast(err.message || 'Upload failed', 'error');
        }
      });
      el.querySelector('[data-single-clear]')?.addEventListener('click', async () => {
        try {
          await onCleared?.();
          render('');
          showToast('Image removed', 'success');
        } catch (err) {
          showToast(err.message || 'Remove failed', 'error');
        }
      });
    };
    render(currentUrl || '');
  },
};
