// App shell: routing, auth gate, sidebar wiring, import/export.

const App = (() => {
  const PAGES = {
    dashboard: { title: 'Dashboard', module: () => Dashboard },
    customers: { title: 'Customers', module: () => Customers },
    jobs:      { title: 'Jobs',      module: () => Jobs },
    calendar:  { title: 'Calendar',  module: () => Calendar },
    companies: { title: 'Companies', module: () => Companies },
  };

  let current = 'dashboard';
  let booted = false;

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

    const signOut = async () => {
      if (!confirm('Sign out of this account?')) return;
      await Supa.signOut();
      Store.reset();
      booted = false;
      Auth.showOverlay();
    };
    document.getElementById('signout-btn').addEventListener('click', signOut);
    const mobileSignout = document.getElementById('mobile-signout');
    if (mobileSignout) mobileSignout.addEventListener('click', signOut);

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
        if (!UI.confirm('Replace ALL current cloud data with the contents of this file?')) return;
        UI.toast('Importing…');
        await Store.importAll(data);
        UI.toast('Imported');
        renderCurrent();
      } catch (e) {
        UI.toast('Import failed: ' + e.message);
      } finally {
        importInput.value = '';
      }
    });
  }

  async function bootApp(user) {
    if (booted) return;
    booted = true;

    document.getElementById('user-email').textContent = user.email;
    Auth.hideOverlay();

    UI.toast('Loading your workspace…');
    await Store.refresh();

    // Offer one-time legacy import if there's data in this browser's localStorage.
    if (Store.legacyDataAvailable()) {
      offerLegacyImport();
    }

    go('dashboard');
  }

  function offerLegacyImport() {
    UI.openModal(`
      <div class="modal-header">
        <h2>Import data from this browser?</h2>
        <button class="modal-close" data-close>${UI.icon('close')}</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom:12px;">We found existing CRM data saved locally in this browser (from before you signed up). Import it into your new workspace?</p>
        <p class="text-muted" style="font-size:13px;">This is a one-time prompt. The local data will be marked as imported so you won't see this again. Existing cloud data in your workspace will be replaced.</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="legacy-skip">Skip — start fresh</button>
        <button type="button" class="btn" id="legacy-import">Import my data</button>
      </div>
    `);

    document.getElementById('legacy-skip').addEventListener('click', () => {
      localStorage.setItem('crm.legacyImported', '1');
      UI.closeModal();
    });
    document.getElementById('legacy-import').addEventListener('click', async () => {
      UI.closeModal();
      UI.toast('Importing your data…');
      try {
        const stats = await Store.importLegacy();
        UI.toast(`Imported ${stats.companies} companies, ${stats.customers} customers, ${stats.jobs} jobs`);
        renderCurrent();
      } catch (e) {
        UI.toast('Import failed: ' + e.message);
      }
    });
  }

  async function init() {
    const client = Supa.init();
    if (!client) {
      alert('Could not initialise Supabase — check your network connection and reload.');
      return;
    }

    wireSidebar();

    Supa.setAuthChangeHandler((user) => {
      if (user) {
        bootApp(user);
      } else {
        booted = false;
        Store.reset();
        document.getElementById('user-email').textContent = '';
        Auth.showOverlay();
      }
    });

    const user = await Supa.getCurrentUser();
    if (user) {
      await bootApp(user);
    } else {
      Auth.showOverlay();
    }
  }

  return { go, init, renderCurrent };
})();

document.addEventListener('DOMContentLoaded', App.init);
