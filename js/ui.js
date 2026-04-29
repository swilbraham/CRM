// Lightweight UI helpers: modal, toast, formatters, escaping.

const UI = (() => {
  const modalRoot = document.getElementById('modal-root');
  const toastRoot = document.getElementById('toast-root');

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(n) {
    const v = Number(n) || 0;
    return '£' + v.toFixed(2);
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateShort(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function jobTotal(job) {
    if (!job || !Array.isArray(job.items)) return 0;
    return job.items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
  }

  // Modal API: open(html, { wide }) returns the modal element so callers can wire events.
  let modalCloseHandler = null;

  function openModal(html, opts = {}) {
    const wide = opts.wide ? ' modal-wide' : '';
    modalRoot.innerHTML = `<div class="modal${wide}" role="dialog">${html}</div>`;
    modalRoot.classList.add('open');
    document.body.style.overflow = 'hidden';

    const closeBtns = modalRoot.querySelectorAll('[data-close]');
    closeBtns.forEach(b => b.addEventListener('click', closeModal));

    modalCloseHandler = (e) => {
      if (e.target === modalRoot) closeModal();
      if (e.key === 'Escape') closeModal();
    };
    modalRoot.addEventListener('click', modalCloseHandler);
    document.addEventListener('keydown', modalCloseHandler);

    return modalRoot.querySelector('.modal');
  }

  function closeModal() {
    modalRoot.classList.remove('open');
    modalRoot.innerHTML = '';
    document.body.style.overflow = '';
    if (modalCloseHandler) {
      document.removeEventListener('keydown', modalCloseHandler);
      modalCloseHandler = null;
    }
  }

  function toast(message) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    toastRoot.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 300);
    }, 2500);
  }

  function confirm(message) {
    return window.confirm(message);
  }

  // Stage definitions used by jobs + dashboard
  const STAGES = [
    { key: 'lead',      label: 'Lead',      dotClass: 'dot-lead',      badgeClass: 'badge-lead' },
    { key: 'quoted',    label: 'Quoted',    dotClass: 'dot-quoted',    badgeClass: 'badge-quoted' },
    { key: 'booked',    label: 'Booked',    dotClass: 'dot-booked',    badgeClass: 'badge-booked' },
    { key: 'completed', label: 'Completed', dotClass: 'dot-completed', badgeClass: 'badge-completed' },
    { key: 'invoiced',  label: 'Invoiced',  dotClass: 'dot-invoiced',  badgeClass: 'badge-invoiced' },
  ];

  function stage(key) {
    return STAGES.find(s => s.key === key) || STAGES[0];
  }

  function badge(stageKey) {
    const s = stage(stageKey);
    return `<span class="badge ${s.badgeClass}">${s.label}</span>`;
  }

  function icon(name) {
    const icons = {
      plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
      close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
      search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>',
      edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3l5 5-12 12H4v-5z"/></svg>',
      trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>',
      print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
      doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>',
      chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>',
      chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>',
    };
    return icons[name] || '';
  }

  return {
    escapeHtml, formatMoney, formatDate, formatDateShort, todayISO, jobTotal,
    openModal, closeModal, toast, confirm,
    STAGES, stage, badge, icon,
  };
})();
