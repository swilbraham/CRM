// Companies page: list both businesses, edit details, upload logo.

const Companies = (() => {
  function render() {
    const page = document.getElementById('page-companies');
    const companies = Store.getCompanies();
    const jobs = Store.getJobs();

    page.innerHTML = `
      <div class="companies-grid">
        ${companies.map(c => {
          const jobCount = jobs.filter(j => j.companyId === c.id).length;
          const revenue = jobs
            .filter(j => j.companyId === c.id && (j.status === 'completed' || j.status === 'invoiced'))
            .reduce((sum, j) => sum + UI.jobTotal(j), 0);
          return `
            <div class="company-card" data-company-id="${c.id}">
              <div class="company-card-head" style="background: linear-gradient(135deg, ${c.color}, ${c.color}cc);">
                ${c.logo
                  ? `<img class="company-logo" src="${UI.escapeHtml(c.logo)}" alt="${UI.escapeHtml(c.name)} logo" />`
                  : `<div class="company-logo-placeholder">${UI.escapeHtml((c.shortName || c.name).slice(0, 2).toUpperCase())}</div>`
                }
              </div>
              <div class="company-card-body">
                <h3>${UI.escapeHtml(c.name)}</h3>
                <div class="company-card-meta">
                  <div><span class="text-muted">Phone:</span> ${UI.escapeHtml(c.phone || '—')}</div>
                  <div><span class="text-muted">Email:</span> ${UI.escapeHtml(c.email || '—')}</div>
                  <div><span class="text-muted">Address:</span> ${UI.escapeHtml(c.address || '—')}</div>
                  ${c.vatNumber ? `<div><span class="text-muted">VAT:</span> ${UI.escapeHtml(c.vatNumber)}</div>` : ''}
                </div>
                <div class="company-stats">
                  <div><strong>${jobCount}</strong> <span class="text-muted">jobs</span></div>
                  <div><strong>${UI.formatMoney(revenue)}</strong> <span class="text-muted">revenue</span></div>
                </div>
                <button class="btn btn-secondary w-full" data-edit="${c.id}">Edit details</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    page.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => openEdit(btn.dataset.edit));
    });
  }

  function openEdit(id) {
    const c = Store.getCompany(id);
    if (!c) return;

    UI.openModal(`
      <div class="modal-header">
        <h2>${UI.escapeHtml(c.name)}</h2>
        <button class="modal-close" data-close>${UI.icon('close')}</button>
      </div>
      <form id="company-form">
        <div class="modal-body">
          <div class="logo-row">
            <div class="logo-preview" id="logo-preview" style="background:${c.color}1a;">
              ${c.logo
                ? `<img src="${UI.escapeHtml(c.logo)}" alt="logo" />`
                : `<span style="color:${c.color};font-weight:700;font-size:24px;">${UI.escapeHtml((c.shortName || c.name).slice(0, 2).toUpperCase())}</span>`
              }
            </div>
            <div class="logo-actions">
              <label class="btn btn-secondary" style="cursor:pointer;">
                Upload logo
                <input type="file" id="logo-file" accept="image/*" hidden />
              </label>
              ${c.logo ? `<button type="button" class="btn btn-secondary" id="remove-logo">Remove</button>` : ''}
              <p class="text-muted" style="font-size:11px;margin-top:6px;">PNG or JPG, recommended under 200KB.</p>
            </div>
          </div>

          <div class="field">
            <label class="label">Business name *</label>
            <input class="input" name="name" required value="${UI.escapeHtml(c.name)}" />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="label">Short name (for badges)</label>
              <input class="input" name="shortName" value="${UI.escapeHtml(c.shortName || '')}" />
            </div>
            <div class="field">
              <label class="label">Brand colour</label>
              <input class="input" type="color" name="color" value="${UI.escapeHtml(c.color || '#2563eb')}" />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="label">Phone</label>
              <input class="input" name="phone" value="${UI.escapeHtml(c.phone || '')}" />
            </div>
            <div class="field">
              <label class="label">Email</label>
              <input class="input" type="email" name="email" value="${UI.escapeHtml(c.email || '')}" />
            </div>
          </div>
          <div class="field">
            <label class="label">Address</label>
            <textarea class="textarea" name="address">${UI.escapeHtml(c.address || '')}</textarea>
          </div>
          <div class="field">
            <label class="label">VAT number (optional)</label>
            <input class="input" name="vatNumber" value="${UI.escapeHtml(c.vatNumber || '')}" />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-close>Cancel</button>
          <button type="submit" class="btn">Save</button>
        </div>
      </form>
    `, { wide: true });

    let pendingLogo = c.logo || '';
    const preview = document.getElementById('logo-preview');

    document.getElementById('logo-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 1024 * 1024) {
        UI.toast('Logo too large (max 1MB)');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        pendingLogo = reader.result;
        preview.innerHTML = `<img src="${pendingLogo}" alt="logo" />`;
      };
      reader.readAsDataURL(file);
    });

    const removeBtn = document.getElementById('remove-logo');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        pendingLogo = '';
        preview.innerHTML = `<span style="color:${c.color};font-weight:700;font-size:24px;">${(c.shortName || c.name).slice(0, 2).toUpperCase()}</span>`;
      });
    }

    document.getElementById('company-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      Store.saveCompany({
        id: c.id,
        name: fd.get('name').trim(),
        shortName: fd.get('shortName').trim() || fd.get('name').trim().split(' ')[0],
        color: fd.get('color') || c.color,
        phone: fd.get('phone').trim(),
        email: fd.get('email').trim(),
        address: fd.get('address').trim(),
        vatNumber: fd.get('vatNumber').trim(),
        logo: pendingLogo,
      });
      UI.closeModal();
      UI.toast('Company updated');
      render();
    });
  }

  function pageActions() { return ''; }
  function attachActions() {}

  return { render, openEdit, pageActions, attachActions };
})();
