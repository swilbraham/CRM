// Jobs page: 5-column kanban with drag-and-drop + per-company filter pills.

const Jobs = (() => {
  function render() {
    const page = document.getElementById('page-jobs');
    const allJobs = Store.getJobs();
    const customers = Store.getCustomers();
    const companies = Store.getCompanies();
    const customerById = Object.fromEntries(customers.map(c => [c.id, c]));
    const companyById = Object.fromEntries(companies.map(c => [c.id, c]));

    const filter = Store.getActiveCompanyFilter();
    const jobs = filter === 'all' ? allJobs : allJobs.filter(j => j.companyId === filter);

    const byStage = {};
    UI.STAGES.forEach(s => { byStage[s.key] = []; });
    jobs.forEach(j => {
      const key = byStage[j.status] ? j.status : 'lead';
      byStage[key].push(j);
    });
    Object.values(byStage).forEach(list => {
      list.sort((a, b) => {
        if (!a.date && !b.date) return b.updatedAt - a.updatedAt;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.localeCompare(b.date);
      });
    });

    page.innerHTML = `
      ${renderFilter(companies, filter, allJobs)}
      <div class="kanban">
        ${UI.STAGES.map(s => `
          <div class="column" data-stage="${s.key}">
            <div class="column-header">
              <div class="column-title">
                <span class="column-dot ${s.dotClass}"></span>
                ${s.label}
              </div>
              <span class="column-count">${byStage[s.key].length}</span>
            </div>
            <div class="column-body" data-drop="${s.key}">
              ${byStage[s.key].map(j => renderCard(j, customerById[j.customerId], companyById[j.companyId])).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    wireFilter();
    wireDragAndDrop();
    wireCardClicks();
  }

  function renderFilter(companies, active, allJobs) {
    const counts = { all: allJobs.length };
    companies.forEach(c => { counts[c.id] = allJobs.filter(j => j.companyId === c.id).length; });
    return `
      <div class="filter-pills">
        <button class="pill ${active === 'all' ? 'active' : ''}" data-filter="all">
          All <span class="pill-count">${counts.all}</span>
        </button>
        ${companies.map(c => `
          <button class="pill ${active === c.id ? 'active' : ''}" data-filter="${c.id}" style="${active === c.id ? `--pill-accent:${c.color};` : ''}">
            <span class="company-dot" style="background:${c.color}"></span>
            ${UI.escapeHtml(c.shortName || c.name)}
            <span class="pill-count">${counts[c.id] || 0}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  function wireFilter() {
    document.querySelectorAll('.pill').forEach(btn => {
      btn.addEventListener('click', () => {
        Store.setActiveCompanyFilter(btn.dataset.filter);
        render();
      });
    });
  }

  function renderCard(job, customer, company) {
    const name = customer ? customer.name : 'Unknown customer';
    const summary = job.items.map(i => i.description).filter(Boolean).join(' · ') || '(No items)';
    const total = UI.jobTotal(job);
    const dateLabel = job.date ? UI.formatDateShort(job.date) : 'Unscheduled';
    const companyTag = company
      ? `<span class="company-tag" style="background:${company.color}1a;color:${company.color}"><span class="company-dot" style="background:${company.color}"></span>${UI.escapeHtml(company.shortName || company.name)}</span>`
      : '';
    return `
      <div class="job-card" draggable="true" data-job-id="${job.id}">
        ${companyTag}
        <div class="job-card-title">${UI.escapeHtml(name)}</div>
        <div class="job-card-sub">${UI.escapeHtml(summary)}</div>
        <div class="job-card-meta">
          <span class="job-card-date">${UI.escapeHtml(dateLabel)}${job.time ? ' · ' + UI.escapeHtml(job.time) : ''}</span>
          <span class="job-card-price">${UI.formatMoney(total)}</span>
        </div>
      </div>
    `;
  }

  function wireDragAndDrop() {
    document.querySelectorAll('.job-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.jobId);
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.column-body.drag-over').forEach(c => c.classList.remove('drag-over'));
      });
    });

    document.querySelectorAll('.column-body').forEach(zone => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', (e) => {
        if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
      });
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const jobId = e.dataTransfer.getData('text/plain');
        const newStage = zone.dataset.drop;
        const job = Store.getJob(jobId);
        if (!job || job.status === newStage) return;
        Store.updateJobStatus(jobId, newStage);
        UI.toast(`Moved to ${UI.stage(newStage).label}`);
        render();
      });
    });
  }

  function wireCardClicks() {
    document.querySelectorAll('.job-card').forEach(card => {
      let downX = 0, downY = 0, moved = false;
      card.addEventListener('mousedown', (e) => { downX = e.clientX; downY = e.clientY; moved = false; });
      card.addEventListener('mousemove', (e) => {
        if (Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5) moved = true;
      });
      card.addEventListener('click', () => {
        if (moved) return;
        const job = Store.getJob(card.dataset.jobId);
        if (job) openForm(job);
      });
    });
  }

  function openForm(job = null) {
    const isEdit = !!(job && job.id);
    const j = job || {};
    const customers = Store.getCustomers();
    const companies = Store.getCompanies();

    if (customers.length === 0) {
      UI.toast('Add a customer first');
      Customers.openForm();
      return;
    }

    // Default company: existing job's, or current filter, or first company
    const currentFilter = Store.getActiveCompanyFilter();
    const defaultCompanyId = j.companyId
      || (currentFilter !== 'all' ? currentFilter : (companies[0] ? companies[0].id : ''));

    const items = (j.items && j.items.length) ? j.items.slice() : [{ description: '', qty: 1, price: 0 }];

    UI.openModal(`
      <div class="modal-header">
        <h2>${isEdit ? 'Edit job' : 'New job'}</h2>
        <button class="modal-close" data-close>${UI.icon('close')}</button>
      </div>
      <form id="job-form">
        <div class="modal-body">
          <div class="field">
            <label class="label">Company *</label>
            <div class="company-picker">
              ${companies.map(c => `
                <label class="company-option">
                  <input type="radio" name="companyId" value="${c.id}" ${c.id === defaultCompanyId ? 'checked' : ''} required />
                  <span class="company-option-body">
                    <span class="company-dot" style="background:${c.color}"></span>
                    <span>${UI.escapeHtml(c.name)}</span>
                  </span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="label">Customer *</label>
              <select class="select" name="customerId" id="customer-select" required>
                <option value="">— Choose a customer —</option>
                ${customers.map(c => `
                  <option value="${c.id}" ${c.id === j.customerId ? 'selected' : ''}>${UI.escapeHtml(c.name)}${c.postcode ? ' · ' + UI.escapeHtml(c.postcode) : ''}</option>
                `).join('')}
              </select>
            </div>
            <div class="field">
              <label class="label">Stage</label>
              <select class="select" name="status">
                ${UI.STAGES.map(s => `
                  <option value="${s.key}" ${(j.status || 'lead') === s.key ? 'selected' : ''}>${s.label}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div id="customer-history"></div>
          <div class="field-row">
            <div class="field">
              <label class="label">Date</label>
              <input class="input" type="date" name="date" value="${UI.escapeHtml(j.date || '')}" />
            </div>
            <div class="field">
              <label class="label">Time</label>
              <input class="input" type="time" name="time" value="${UI.escapeHtml(j.time || '')}" />
            </div>
          </div>

          <label class="label" style="margin-top: 8px;">Line items</label>
          <table class="items-table" id="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="width: 70px;">Qty</th>
                <th style="width: 100px;">Price (£)</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="items-body"></tbody>
          </table>
          <button type="button" class="add-item" id="add-item">+ Add item</button>

          <div class="totals">
            <span>Total</span>
            <span id="total-display">£0.00</span>
          </div>

          <div class="field" style="margin-top: 16px;">
            <label class="label">Notes</label>
            <textarea class="textarea" name="notes" placeholder="Stains to treat, access info, parking...">${UI.escapeHtml(j.notes || '')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          ${isEdit ? `<button type="button" class="btn btn-danger" id="delete-job">Delete</button>` : ''}
          ${isEdit ? `<button type="button" class="btn btn-secondary" id="quote-btn">${UI.icon('doc')} Quote / Invoice</button>` : ''}
          <button type="button" class="btn btn-secondary" data-close>Cancel</button>
          <button type="submit" class="btn">${isEdit ? 'Save changes' : 'Create job'}</button>
        </div>
      </form>
    `, { wide: true });

    const historyPanel = document.getElementById('customer-history');
    const customerSelect = document.getElementById('customer-select');
    const companyById = Object.fromEntries(Store.getCompanies().map(c => [c.id, c]));

    function renderHistory(customerId) {
      if (!customerId) { historyPanel.innerHTML = ''; return; }
      const past = Store.getJobsForCustomer(customerId)
        .filter(pj => pj.id !== j.id)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      if (past.length === 0) {
        historyPanel.innerHTML = `
          <div class="history-panel">
            <div class="history-head">
              <span>Previous jobs for this customer</span>
              <span class="text-muted">none yet</span>
            </div>
            <p class="text-muted" style="font-size:12px;padding:10px 14px;">First job for this customer.</p>
          </div>
        `;
        return;
      }
      const quotedCount = past.filter(p => p.status === 'quoted').length;
      historyPanel.innerHTML = `
        <div class="history-panel">
          <div class="history-head">
            <span>Previous jobs for this customer</span>
            <span class="text-muted">${past.length} total${quotedCount ? ` · ${quotedCount} open quote${quotedCount > 1 ? 's' : ''}` : ''}</span>
          </div>
          <div class="history-list">
            ${past.map(pj => {
              const co = companyById[pj.companyId];
              const summary = pj.items.map(i => i.description).filter(Boolean).join(', ') || '(no items)';
              return `
                <div class="history-item" data-history-id="${pj.id}" title="Click to view document">
                  <div class="history-item-main">
                    <div class="history-item-top">
                      ${UI.badge(pj.status)}
                      ${co ? `<span class="company-tag" style="background:${co.color}1a;color:${co.color};margin:0;"><span class="company-dot" style="background:${co.color}"></span>${UI.escapeHtml(co.shortName || co.name)}</span>` : ''}
                      <span class="text-muted" style="font-size:12px;">${pj.date ? UI.formatDate(pj.date) : 'Unscheduled'}</span>
                    </div>
                    <div class="history-item-summary">${UI.escapeHtml(summary)}</div>
                  </div>
                  <div class="history-item-side">
                    <strong>${UI.formatMoney(UI.jobTotal(pj))}</strong>
                    ${(pj.status === 'quoted' || pj.status === 'invoiced')
                      ? `<button type="button" class="btn-icon history-view" data-view="${pj.id}" title="View ${pj.status === 'invoiced' ? 'invoice' : 'quote'}">${UI.icon('doc')}</button>`
                      : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
      historyPanel.querySelectorAll('.history-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          UI.closeModal();
          Quote.open(btn.dataset.view);
        });
      });
    }

    customerSelect.addEventListener('change', (e) => renderHistory(e.target.value));
    renderHistory(customerSelect.value);

    const tbody = document.getElementById('items-body');
    function renderItems() {
      tbody.innerHTML = items.map((it, idx) => `
        <tr class="item-row" data-idx="${idx}">
          <td><input class="input" data-field="description" value="${UI.escapeHtml(it.description || '')}" placeholder="e.g. Lounge carpet, 3-seater sofa" /></td>
          <td><input class="input" type="number" min="1" step="1" data-field="qty" value="${it.qty || 1}" /></td>
          <td><input class="input" type="number" min="0" step="0.01" data-field="price" value="${it.price || 0}" /></td>
          <td><button type="button" class="row-remove" data-remove="${idx}">${UI.icon('trash')}</button></td>
        </tr>
      `).join('');
      tbody.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', (e) => {
          const tr = e.target.closest('tr');
          const idx = Number(tr.dataset.idx);
          const field = e.target.dataset.field;
          items[idx][field] = field === 'description' ? e.target.value : Number(e.target.value);
          updateTotal();
        });
      });
      tbody.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.remove);
          items.splice(idx, 1);
          if (items.length === 0) items.push({ description: '', qty: 1, price: 0 });
          renderItems();
          updateTotal();
        });
      });
    }

    function updateTotal() {
      const total = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
      document.getElementById('total-display').textContent = UI.formatMoney(total);
    }

    renderItems();
    updateTotal();

    document.getElementById('add-item').addEventListener('click', () => {
      items.push({ description: '', qty: 1, price: 0 });
      renderItems();
    });

    document.getElementById('job-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const cleanItems = items.filter(it => (it.description || '').trim());
      if (cleanItems.length === 0) {
        UI.toast('Add at least one line item');
        return;
      }
      const newStatus = fd.get('status');
      const payload = {
        ...(isEdit ? { id: j.id } : {}),
        customerId: fd.get('customerId'),
        companyId: fd.get('companyId'),
        status: newStatus,
        date: fd.get('date'),
        time: fd.get('time'),
        notes: fd.get('notes').trim(),
        items: cleanItems,
      };
      if (isEdit) {
        if (j.invoiceNo) payload.invoiceNo = j.invoiceNo;
        if (j.quoteNo) payload.quoteNo = j.quoteNo;
      }
      const saved = Store.saveJob(payload);
      if ((newStatus === 'quoted' && !saved.quoteNo) || (newStatus === 'invoiced' && !saved.invoiceNo)) {
        Store.updateJobStatus(saved.id, newStatus);
      }
      UI.closeModal();
      UI.toast(isEdit ? 'Job updated' : 'Job created');
      App.renderCurrent();
    });

    if (isEdit) {
      document.getElementById('delete-job').addEventListener('click', () => {
        if (UI.confirm('Delete this job? This cannot be undone.')) {
          Store.deleteJob(j.id);
          UI.closeModal();
          UI.toast('Job deleted');
          App.renderCurrent();
        }
      });
      document.getElementById('quote-btn').addEventListener('click', () => {
        Quote.open(j.id);
      });
    }
  }

  function pageActions() {
    return `<button class="btn" id="new-job-btn">${UI.icon('plus')} New job</button>`;
  }

  function attachActions() {
    const btn = document.getElementById('new-job-btn');
    if (btn) btn.addEventListener('click', () => openForm());
  }

  return { render, openForm, pageActions, attachActions };
})();
