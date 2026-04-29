// Calendar page: month view of all jobs by date.

const Calendar = (() => {
  let view = new Date(); view.setDate(1);

  function render() {
    const page = document.getElementById('page-calendar');
    const jobs = Store.getJobs().filter(j => j.date);
    const customers = Store.getCustomers();
    const customerById = Object.fromEntries(customers.map(c => [c.id, c]));

    const year = view.getFullYear();
    const month = view.getMonth();
    const monthName = view.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    // First day of month, then back up to start of week (Mon)
    const first = new Date(year, month, 1);
    const startWeekday = (first.getDay() + 6) % 7; // Mon = 0
    const start = new Date(year, month, 1 - startWeekday);

    // Always render 6 weeks for consistent layout
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    function jobsForDay(d) {
      const iso = d.toISOString().slice(0, 10);
      return jobs.filter(j => j.date === iso);
    }

    page.innerHTML = `
      <div class="calendar">
        <div class="calendar-head">
          <h2>${monthName}</h2>
          <div class="cal-nav">
            <button class="btn-icon" id="cal-prev">${UI.icon('chevronLeft')}</button>
            <button class="btn-secondary btn" id="cal-today" style="padding: 6px 12px; font-size: 12px;">Today</button>
            <button class="btn-icon" id="cal-next">${UI.icon('chevronRight')}</button>
          </div>
        </div>
        <div class="cal-grid">
          ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => `<div class="dow">${d}</div>`).join('')}
          ${days.map(d => {
            const isOther = d.getMonth() !== month;
            const isToday = d.getTime() === today.getTime();
            const dayJobs = jobsForDay(d);
            return `
              <div class="cal-day ${isOther ? 'other' : ''} ${isToday ? 'today' : ''}">
                <div class="cal-day-num">${d.getDate()}</div>
                ${dayJobs.map(j => {
                  const c = customerById[j.customerId];
                  const name = c ? c.name.split(' ')[0] : '?';
                  return `<div class="cal-event" data-job-id="${j.id}" title="${UI.escapeHtml((c ? c.name : 'Unknown') + ' · ' + j.items.map(i => i.description).join(', '))}">${UI.escapeHtml(name)}</div>`;
                }).join('')}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    document.getElementById('cal-prev').addEventListener('click', () => {
      view = new Date(year, month - 1, 1); render();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      view = new Date(year, month + 1, 1); render();
    });
    document.getElementById('cal-today').addEventListener('click', () => {
      view = new Date(); view.setDate(1); render();
    });
    document.querySelectorAll('.cal-event').forEach(el => {
      el.addEventListener('click', () => {
        const job = Store.getJob(el.dataset.jobId);
        if (job) Jobs.openForm(job);
      });
    });
  }

  function pageActions() {
    return `<button class="btn" id="new-job-cal-btn">${UI.icon('plus')} New job</button>`;
  }

  function attachActions() {
    const btn = document.getElementById('new-job-cal-btn');
    if (btn) btn.addEventListener('click', () => Jobs.openForm());
  }

  return { render, pageActions, attachActions };
})();
