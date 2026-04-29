// App shell: routing between pages, top-bar action wiring, import/export.

const App = (() => {
  const PAGES = {
    dashboard: { title: 'Dashboard', module: () => Dashboard },
    customers: { title: 'Customers', module: () => Customers },
    jobs:      { title: 'Jobs',      module: () => Jobs },
    calendar:  { title: 'Calendar',  module: () => Calendar },
    companies: { title: 'Companies', module: () => Companies },
  };

  let current = 'dashboard';

  function go(route) {
    if (!PAGES[route]) return;
    current = route;

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.route === route);
    });
    document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
    document.getElementById(`page-${route}`).classList.remove('hidden');
    document.getElementById('page-title').textContent = PAGES[route].title;

    const mod = PAGES[route].module();
    document.getElementById('page-actions').innerHTML = mod.pageActions ? mod.pageActions() : '';
    if (mod.attachActions) mod.attachActions();
    mod.render();
  }

  function renderCurrent() {
    const mod = PAGES[current].module();
    mod.render();
    if (mod.attachActions) mod.attachActions();
  }

  function wireSidebar() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => go(el.dataset.route));
    });
  }

  function wireImportExport() {
    document.getElementById('export-btn').addEventListener('click', () => {
      const data = Store.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      UI.toast('Exported');
    });

    const importInput = document.getElementById('import-file');
    document.getElementById('import-btn').addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async () => {
      const file = importInput.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!UI.confirm('Replace all current customers and jobs with this file?')) return;
        Store.importAll(data);
        UI.toast('Imported');
        renderCurrent();
      } catch (e) {
        UI.toast('Import failed: ' + e.message);
      } finally {
        importInput.value = '';
      }
    });
  }

  function init() {
    Store.seedIfEmpty();
    wireSidebar();
    wireImportExport();
    go('dashboard');
  }

  return { go, init, renderCurrent };
})();

document.addEventListener('DOMContentLoaded', App.init);
