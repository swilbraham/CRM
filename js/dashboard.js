// Dashboard: at-a-glance stats + upcoming jobs + outstanding quotes.

const Dashboard = (() => {
  function render() {
    const page = document.getElementById('page-dashboard');
    const jobs = Store.getJobs();
    const customers = Store.getCustomers();
    const customerById = Object.fromEntries(customers.map(c => [c.id, c]));

    const today = UI.todayISO();
    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const in7iso = in7.toISOString().slice(0, 10);

    const upcoming = jobs
      .filter(j => j.date && j.date >= today && j.date <= in7iso && (j.status === 'booked' || j.status === 'quoted'))
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

    const leads = jobs.filter(j => j.status === 'lead');
    const quoted = jobs.filter(j => j.status === 'quoted');

    // Revenue this month: sum of completed/invoiced jobs whose date is this month
    const now = new Date();
    const monthPrefix = now.toISOString().slice(0, 7);
    const monthRevenue = jobs
      .filter(j => (j.status === 'completed' || j.status === 'invoiced') && j.date && j.date.startsWith(monthPrefix))
      .reduce((sum, j) => sum + UI.jobTotal(j), 0);

    const activeJobs = jobs.filter(j => j.status === 'booked').length;

    page.innerHTML = `
      <div class="stats-grid">
        <div class="stat">
          <div class="stat-label">Booked jobs</div>
          <div class="stat-value">${activeJobs}</div>
          <div class="stat-sub">scheduled and confirmed</div>
        </div>
        <div class="stat">
          <div class="stat-label">Revenue this month</div>
          <div class="stat-value">${UI.formatMoney(monthRevenue)}</div>
          <div class="stat-sub">completed + invoiced</div>
        </div>
        <div class="stat">
          <div class="stat-label">Open quotes</div>
          <div class="stat-value">${quoted.length}</div>
          <div class="stat-sub">awaiting customer reply</div>
        </div>
        <div class="stat">
          <div class="stat-label">New leads</div>
          <div class="stat-value">${leads.length}</div>
          <div class="stat-sub">to follow up</div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <h2>Upcoming next 7 days</h2>
          </div>
          <div>
            ${upcoming.length === 0 ? `
              <div class="empty"><p>No jobs scheduled in the next week.</p></div>
            ` : `
              <table class="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Service</th>
                    <th>Status</th>
                    <th class="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${upcoming.map(j => {
                    const c = customerById[j.customerId];
                    return `
                      <tr data-job-id="${j.id}">
                        <td><strong>${UI.formatDateShort(j.date)}</strong>${j.time ? ' · ' + UI.escapeHtml(j.time) : ''}</td>
                        <td>${UI.escapeHtml(c ? c.name : 'Unknown')}</td>
                        <td>${UI.escapeHtml(j.items.map(i => i.description).filter(Boolean).join(', ') || '—')}</td>
                        <td>${UI.badge(j.status)}</td>
                        <td class="text-right"><strong>${UI.formatMoney(UI.jobTotal(j))}</strong></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>Leads to follow up</h2>
          </div>
          <div>
            ${leads.length === 0 ? `
              <div class="empty"><p>No new leads. Add one from the Jobs page.</p></div>
            ` : `
              <table class="table">
                <thead><tr><th>Customer</th><th class="text-right">Est.</th></tr></thead>
                <tbody>
                  ${leads.map(j => {
                    const c = customerById[j.customerId];
                    return `
                      <tr data-job-id="${j.id}">
                        <td>
                          <strong>${UI.escapeHtml(c ? c.name : 'Unknown')}</strong>
                          ${c && c.phone ? `<div class="text-muted" style="font-size: 12px;">${UI.escapeHtml(c.phone)}</div>` : ''}
                        </td>
                        <td class="text-right">${UI.formatMoney(UI.jobTotal(j))}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    `;

    page.querySelectorAll('[data-job-id]').forEach(row => {
      row.addEventListener('click', () => {
        const j = Store.getJob(row.dataset.jobId);
        if (j) Jobs.openForm(j);
      });
    });
  }

  function pageActions() {
    return `
      <button class="btn btn-secondary" id="dash-new-customer">${UI.icon('plus')} Customer</button>
      <button class="btn" id="dash-new-job">${UI.icon('plus')} New job</button>
    `;
  }

  function attachActions() {
    const c = document.getElementById('dash-new-customer');
    const j = document.getElementById('dash-new-job');
    if (c) c.addEventListener('click', () => Customers.openForm());
    if (j) j.addEventListener('click', () => Jobs.openForm());
  }

  return { render, pageActions, attachActions };
})();
