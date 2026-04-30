// Companies page: list businesses, add/edit/delete, upload logo.

const Companies = (() => {
  const PALETTE = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#db2777', '#ca8a04'];

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
        <button class="company-card company-add" type="button" id="add-company-card">
          <div class="company-add-inner">
            ${UI.icon('plus')}
            <strong>Add company</strong>
            <span class="text-muted">Set up a new brand with its own logo, colour, and contact details</span>
          </div>
        </button>
      </div>
    `;

    page.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => openForm(Store.getCompany(btn.dataset.edit)));
    });
    document.getElementById('add-company-card').addEventListener('click', () => openForm(null));
  }

  function openForm(company) {
    const isEdit = !!company;
    const c = company || {
      id: '',
      name: '',
      shortName: '',
      color: PALETTE[Store.getCompanies().length % PALETTE.length],
      logo: '',
      phone: '',
      email: '',
      address: '',
      vatNumber: '',
    };
    const jobsForCompany = isEdit
      ? Store.getJobs().filter(j => j.companyId === c.id).length
      : 0;

    UI.openModal(`
      <div class="modal-header">
        <h2>${isEdit ? UI.escapeHtml(c.name) : 'New company'}</h2>
        <button class="modal-close" data-close>${UI.icon('close')}</button>
      </div>
      <form id="company-form">
        <div class="modal-body">
          <div class="logo-row">
            <div class="logo-preview" id="logo-preview" style="background:${c.color}1a;">
              ${c.logo
                ? `<img src="${UI.escapeHtml(c.logo)}" alt="logo" />`
                : `<span style="color:${c.color};font-weight:700;font-size:24px;" id="logo-initials">${UI.escapeHtml((c.shortName || c.name || '?').slice(0, 2).toUpperCase())}</span>`
              }
            </div>
            <div class="logo-actions">
              <label class="btn btn-secondary" style="cursor:pointer;">
                Upload logo
                <input type="file" id="logo-file" accept="image/*" hidden />
              </label>
              <button type="button" class="btn btn-secondary" id="remove-logo" ${c.logo ? '' : 'style="display:none;"'}>Remove</button>
              <p class="text-muted" style="font-size:11px;margin-top:6px;">PNG or JPG, recommended under 200KB.</p>
            </div>
          </div>

          <div class="field">
            <label class="label">Business name *</label>
            <input class="input" name="name" required value="${UI.escapeHtml(c.name)}" autofocus />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="label">Short name (for badges)</label>
              <input class="input" name="shortName" value="${UI.escapeHtml(c.shortName || '')}" placeholder="e.g. Wirral" />
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
          ${isEdit ? `<button type="button" class="btn btn-danger" id="delete-company" ${jobsForCompany > 0 ? 'disabled title="Reassign or delete this company&#39;s jobs first"' : ''}>Delete${jobsForCompany > 0 ? ` (${jobsForCompany} jobs)` : ''}</button>` : ''}
          <button type="button" class="btn btn-secondary" data-close>Cancel</button>
          <button type="submit" class="btn">${isEdit ? 'Save' : 'Create company'}</button>
        </div>
      </form>
    `, { wide: true });

    let pendingLogo = c.logo || '';
    const preview = document.getElementById('logo-preview');
    const removeBtn = document.getElementById('remove-logo');

    function refreshPlaceholder() {
      const initialsEl = document.getElementById('logo-initials');
      if (!initialsEl) return;
      const nameVal = document.querySelector('input[name="name"]').value;
      const shortVal = document.querySelector('input[name="shortName"]').value;
      const text = (shortVal || nameVal || '?').slice(0, 2).toUpperCase();
      initialsEl.textContent = text;
    }

    document.querySelector('input[name="name"]').addEventListener('input', refreshPlaceholder);
    document.querySelector('input[name="shortName"]').addEventListener('input', refreshPlaceholder);

    document.querySelector('input[name="color"]').addEventListener('input', (e) => {
      const col = e.target.value;
      preview.style.background = col + '1a';
      const initialsEl = document.getElementById('logo-initials');
      if (initialsEl) initialsEl.style.color = col;
    });

    document.getElementById('logo-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 1024 * 1024) { UI.toast('Logo too large (max 1MB)'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        pendingLogo = reader.result;
        preview.innerHTML = `<img src="${pendingLogo}" alt="logo" />`;
        removeBtn.style.display = '';
      };
      reader.readAsDataURL(file);
    });

    removeBtn.addEventListener('click', () => {
      pendingLogo = '';
      const col = document.querySelector('input[name="color"]').value;
      const nameVal = document.querySelector('input[name="name"]').value;
      const shortVal = document.querySelector('input[name="shortName"]').value;
      const text = (shortVal || nameVal || '?').slice(0, 2).toUpperCase();
      preview.innerHTML = `<span style="color:${col};font-weight:700;font-size:24px;" id="logo-initials">${text}</span>`;
      removeBtn.style.display = 'none';
    });

    document.getElementById('company-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = fd.get('name').trim();
      try {
        await Store.saveCompany({
          ...(isEdit ? { id: c.id } : {}),
          name,
          shortName: fd.get('shortName').trim() || name.split(' ')[0],
          color: fd.get('color') || c.color,
          phone: fd.get('phone').trim(),
          email: fd.get('email').trim(),
          address: fd.get('address').trim(),
          vatNumber: fd.get('vatNumber').trim(),
          logo: pendingLogo,
        });
        UI.closeModal();
        UI.toast(isEdit ? 'Company updated' : 'Company added');
        render();
      } catch (err) {
        UI.toast('Save failed: ' + err.message);
      }
    });

    if (isEdit) {
      const delBtn = document.getElementById('delete-company');
      if (delBtn && !delBtn.disabled) {
        delBtn.addEventListener('click', async () => {
          if (UI.confirm(`Delete ${c.name}? This cannot be undone.`)) {
            try {
              await Store.deleteCompany(c.id);
              if (Store.getActiveCompanyFilter() === c.id) await Store.setActiveCompanyFilter('all');
              UI.closeModal();
              UI.toast('Company deleted');
              render();
            } catch (err) {
              UI.toast('Delete failed: ' + err.message);
            }
          }
        });
      }
    }
  }

  function pageActions() {
    return `<button class="btn" id="add-company-btn">${UI.icon('plus')} Add company</button>`;
  }

  function attachActions() {
    const btn = document.getElementById('add-company-btn');
    if (btn) btn.addEventListener('click', () => openForm(null));
  }

  // Backwards-compat alias used by quote.js "Edit company details"
  function openEdit(id) {
    const c = Store.getCompany(id);
    if (c) openForm(c);
  }

  return { render, openForm, openEdit, pageActions, attachActions };
})();
