// Customers page: search, table, add/edit/view modal with service history.

const Customers = (() => {
  let searchTerm = '';

  function render() {
    const page = document.getElementById('page-customers');
    const customers = Store.getCustomers();
    const jobs = Store.getJobs();

    // Compute aggregate stats per customer
    const stats = {};
    customers.forEach(c => {
      const cJobs = jobs.filter(j => j.customerId === c.id);
      const lastDate = cJobs
        .filter(j => j.date)
        .map(j => j.date)
        .sort()
        .pop();
      const total = cJobs
        .filter(j => j.status === 'invoiced' || j.status === 'completed')
        .reduce((sum, j) => sum + UI.jobTotal(j), 0);
      stats[c.id] = { count: cJobs.length, lastDate, total };
    });

    const term = searchTerm.toLowerCase().trim();
    const filtered = term
      ? customers.filter(c =>
          [c.name, c.phone, c.email, c.address, c.city, c.postcode]
            .filter(Boolean)
            .some(v => v.toLowerCase().includes(term))
        )
      : customers;

    page.innerHTML = `
      <div class="search-row">
        <div class="search">
          ${UI.icon('search')}
          <input type="search" id="customer-search" placeholder="Search by name, phone, postcode..." value="${UI.escapeHtml(searchTerm)}" />
        </div>
      </div>
      <div class="card">
        ${filtered.length === 0 ? renderEmpty() : `
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Last service</th>
              <th>Jobs</th>
              <th class="text-right">Total spent</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(c => {
              const s = stats[c.id];
              const addr = [c.address, c.city, c.postcode].filter(Boolean).join(', ');
              return `
                <tr data-id="${c.id}">
                  <td><strong>${UI.escapeHtml(c.name)}</strong></td>
                  <td>${UI.escapeHtml(c.phone || '')}</td>
                  <td>${UI.escapeHtml(addr) || '<span class="text-muted">—</span>'}</td>
                  <td>${s.lastDate ? UI.formatDate(s.lastDate) : '<span class="text-muted">—</span>'}</td>
                  <td>${s.count}</td>
                  <td class="text-right"><strong>${UI.formatMoney(s.total)}</strong></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        `}
      </div>
    `;

    page.querySelector('#customer-search').addEventListener('input', (e) => {
      searchTerm = e.target.value;
      render();
    });

    page.querySelectorAll('tbody tr').forEach(row => {
      row.addEventListener('click', () => openDetail(row.dataset.id));
    });
  }

  function renderEmpty() {
    return `
      <div class="empty">
        <h3>${searchTerm ? 'No customers match your search' : 'No customers yet'}</h3>
        <p>${searchTerm ? 'Try a different name, phone, or postcode.' : 'Click + New Customer to add your first one.'}</p>
      </div>
    `;
  }

  function openForm(customer = null) {
    const c = customer || {};
    const isEdit = !!customer;
    UI.openModal(`
      <div class="modal-header">
        <h2>${isEdit ? 'Edit customer' : 'New customer'}</h2>
        <button class="modal-close" data-close>${UI.icon('close')}</button>
      </div>
      <form id="customer-form">
        <div class="modal-body">
          <div class="field">
            <label class="label">Name *</label>
            <input class="input" name="name" required value="${UI.escapeHtml(c.name || '')}" autofocus />
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
            <input class="input" name="address" value="${UI.escapeHtml(c.address || '')}" />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="label">Town / city</label>
              <input class="input" name="city" value="${UI.escapeHtml(c.city || '')}" />
            </div>
            <div class="field">
              <label class="label">Postcode</label>
              <input class="input" name="postcode" value="${UI.escapeHtml(c.postcode || '')}" />
            </div>
          </div>
          <div class="field">
            <label class="label">Notes</label>
            <textarea class="textarea" name="notes" placeholder="Pets, fabric types, allergies, gate codes...">${UI.escapeHtml(c.notes || '')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          ${isEdit ? `<button type="button" class="btn btn-danger" id="delete-customer">Delete</button>` : ''}
          <button type="button" class="btn btn-secondary" data-close>Cancel</button>
          <button type="submit" class="btn">${isEdit ? 'Save changes' : 'Add customer'}</button>
        </div>
      </form>
    `);

    const form = document.getElementById('customer-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        ...(isEdit ? { id: c.id } : {}),
        name: fd.get('name').trim(),
        phone: fd.get('phone').trim(),
        email: fd.get('email').trim(),
        address: fd.get('address').trim(),
        city: fd.get('city').trim(),
        postcode: fd.get('postcode').trim(),
        notes: fd.get('notes').trim(),
      };
      Store.saveCustomer(payload);
      UI.closeModal();
      UI.toast(isEdit ? 'Customer updated' : 'Customer added');
      render();
    });

    if (isEdit) {
      document.getElementById('delete-customer').addEventListener('click', () => {
        if (UI.confirm(`Delete ${c.name}? Their job history will be kept but unlinked.`)) {
          Store.deleteCustomer(c.id);
          UI.closeModal();
          UI.toast('Customer deleted');
          render();
        }
      });
    }
  }

  function openDetail(id) {
    const c = Store.getCustomer(id);
    if (!c) return;
    const jobs = Store.getJobsForCustomer(id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const total = jobs
      .filter(j => j.status === 'invoiced' || j.status === 'completed')
      .reduce((sum, j) => sum + UI.jobTotal(j), 0);

    UI.openModal(`
      <div class="modal-header">
        <h2>${UI.escapeHtml(c.name)}</h2>
        <button class="modal-close" data-close>${UI.icon('close')}</button>
      </div>
      <div class="modal-body">
        <div class="detail-grid">
          <div class="detail-item">
            <div class="detail-label">Phone</div>
            <div class="detail-value ${!c.phone ? 'empty' : ''}">${UI.escapeHtml(c.phone || 'Not set')}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Email</div>
            <div class="detail-value ${!c.email ? 'empty' : ''}">${UI.escapeHtml(c.email || 'Not set')}</div>
          </div>
          <div class="detail-item" style="grid-column: span 2;">
            <div class="detail-label">Address</div>
            <div class="detail-value ${!c.address ? 'empty' : ''}">${
              [c.address, c.city, c.postcode].filter(Boolean).map(UI.escapeHtml).join(', ') || 'Not set'
            }</div>
          </div>
          <div class="detail-item" style="grid-column: span 2;">
            <div class="detail-label">Notes</div>
            <div class="detail-value ${!c.notes ? 'empty' : ''}">${UI.escapeHtml(c.notes || 'No notes')}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Total spent</div>
            <div class="detail-value">${UI.formatMoney(total)}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Jobs to date</div>
            <div class="detail-value">${jobs.length}</div>
          </div>
        </div>

        <h3 style="font-size: 14px; margin-bottom: 10px;">Service history</h3>
        ${jobs.length === 0 ? `
          <div class="empty" style="padding: 30px;">
            <p>No jobs yet for this customer.</p>
          </div>
        ` : `
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Service</th>
                <th>Status</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${jobs.map(j => `
                <tr data-job-id="${j.id}">
                  <td>${j.date ? UI.formatDate(j.date) : '<span class="text-muted">—</span>'}</td>
                  <td>${j.items.map(i => UI.escapeHtml(i.description)).join(', ') || '<span class="text-muted">—</span>'}</td>
                  <td>${UI.badge(j.status)}</td>
                  <td class="text-right"><strong>${UI.formatMoney(UI.jobTotal(j))}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-close>Close</button>
        <button type="button" class="btn btn-secondary" id="edit-customer-btn">Edit details</button>
        <button type="button" class="btn" id="new-job-for-customer">New job</button>
      </div>
    `, { wide: true });

    document.getElementById('edit-customer-btn').addEventListener('click', () => {
      UI.closeModal();
      openForm(c);
    });
    document.getElementById('new-job-for-customer').addEventListener('click', () => {
      UI.closeModal();
      Jobs.openForm({ customerId: c.id });
    });
    document.querySelectorAll('[data-job-id]').forEach(row => {
      row.addEventListener('click', () => {
        UI.closeModal();
        Jobs.openForm(Store.getJob(row.dataset.jobId));
      });
    });
  }

  function pageActions() {
    return `<button class="btn" id="new-customer-btn">${UI.icon('plus')} New customer</button>`;
  }

  function attachActions() {
    const btn = document.getElementById('new-customer-btn');
    if (btn) btn.addEventListener('click', () => openForm());
  }

  return { render, openForm, openDetail, pageActions, attachActions };
})();
