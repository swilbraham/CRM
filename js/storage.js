// Local-first persistence layer. Stores customers + jobs in localStorage as JSON.
// Single source of truth — every page reads through Store.

const Store = (() => {
  const KEYS = {
    customers: 'crm.customers',
    jobs: 'crm.jobs',
    settings: 'crm.settings',
    companies: 'crm.companies',
  };

  const DEFAULT_COMPANIES = [
    {
      id: 'wirral',
      name: 'Wirral Carpet Cleaning Limited',
      shortName: 'Wirral',
      color: '#0ea5e9',
      logo: '',
      phone: '',
      email: '',
      address: '',
      vatNumber: '',
    },
    {
      id: 'freshforless',
      name: 'Fresh For Less Carpet Cleaning',
      shortName: 'Fresh For Less',
      color: '#16a34a',
      logo: '',
      phone: '',
      email: '',
      address: '',
      vatNumber: '',
    },
  ];

  const DEFAULT_SETTINGS = {
    nextInvoiceNo: 1001,
    nextQuoteNo: 2001,
    activeCompanyFilter: 'all',
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // --- Companies ---
  function getCompanies() {
    let list = read(KEYS.companies, null);
    if (!list || !Array.isArray(list) || list.length === 0) {
      // Migrate from legacy single-business settings if present
      const legacy = read(KEYS.settings, {});
      if (legacy && legacy.businessName && legacy.businessName !== 'Carpet & Upholstery Cleaning') {
        list = [{
          id: 'legacy',
          name: legacy.businessName,
          shortName: legacy.businessName.split(' ')[0],
          color: '#2563eb',
          logo: '',
          phone: legacy.businessPhone || '',
          email: legacy.businessEmail || '',
          address: legacy.businessAddress || '',
          vatNumber: legacy.vatNumber || '',
        }, ...DEFAULT_COMPANIES.slice(1)];
      } else {
        list = DEFAULT_COMPANIES.slice();
      }
      write(KEYS.companies, list);
    }
    return list;
  }

  function getCompany(id) {
    return getCompanies().find(c => c.id === id);
  }

  function saveCompany(data) {
    const all = getCompanies();
    const i = all.findIndex(c => c.id === data.id);
    if (i >= 0) {
      all[i] = { ...all[i], ...data };
    } else {
      data.id = data.id || uid();
      all.push(data);
    }
    write(KEYS.companies, all);
    return all[i >= 0 ? i : all.length - 1];
  }

  // --- Customers ---
  function getCustomers() {
    return read(KEYS.customers, []);
  }

  function getCustomer(id) {
    return getCustomers().find(c => c.id === id);
  }

  function saveCustomer(data) {
    const all = getCustomers();
    if (data.id) {
      const i = all.findIndex(c => c.id === data.id);
      if (i >= 0) all[i] = { ...all[i], ...data, updatedAt: Date.now() };
    } else {
      data.id = uid();
      data.createdAt = Date.now();
      data.updatedAt = Date.now();
      all.push(data);
    }
    write(KEYS.customers, all);
    return data;
  }

  function deleteCustomer(id) {
    write(KEYS.customers, getCustomers().filter(c => c.id !== id));
  }

  // --- Jobs ---
  function getJobs() {
    return read(KEYS.jobs, []);
  }

  function getJob(id) {
    return getJobs().find(j => j.id === id);
  }

  function getJobsForCustomer(customerId) {
    return getJobs().filter(j => j.customerId === customerId);
  }

  function saveJob(data) {
    const all = getJobs();
    if (data.id) {
      const i = all.findIndex(j => j.id === data.id);
      if (i >= 0) all[i] = { ...all[i], ...data, updatedAt: Date.now() };
    } else {
      data.id = uid();
      data.createdAt = Date.now();
      data.updatedAt = Date.now();
      data.status = data.status || 'lead';
      // Default to first company if not specified
      if (!data.companyId) {
        const companies = getCompanies();
        data.companyId = companies[0] ? companies[0].id : '';
      }
      all.push(data);
    }
    write(KEYS.jobs, all);
    return data;
  }

  function updateJobStatus(id, status) {
    const all = getJobs();
    const i = all.findIndex(j => j.id === id);
    if (i < 0) return null;
    all[i].status = status;
    all[i].updatedAt = Date.now();
    if (status === 'invoiced' && !all[i].invoiceNo) {
      const settings = getSettings();
      all[i].invoiceNo = settings.nextInvoiceNo;
      saveSettings({ ...settings, nextInvoiceNo: settings.nextInvoiceNo + 1 });
    }
    if (status === 'quoted' && !all[i].quoteNo) {
      const settings = getSettings();
      all[i].quoteNo = settings.nextQuoteNo;
      saveSettings({ ...settings, nextQuoteNo: settings.nextQuoteNo + 1 });
    }
    write(KEYS.jobs, all);
    return all[i];
  }

  function deleteJob(id) {
    write(KEYS.jobs, getJobs().filter(j => j.id !== id));
  }

  // --- Settings (counters + active filter) ---
  function getSettings() {
    return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
  }

  function saveSettings(data) {
    write(KEYS.settings, data);
    return data;
  }

  function getActiveCompanyFilter() {
    return getSettings().activeCompanyFilter || 'all';
  }

  function setActiveCompanyFilter(id) {
    const s = getSettings();
    saveSettings({ ...s, activeCompanyFilter: id });
  }

  // --- Export / import ---
  function exportAll() {
    return {
      customers: getCustomers(),
      jobs: getJobs(),
      settings: getSettings(),
      companies: getCompanies(),
      exportedAt: new Date().toISOString(),
      version: 2,
    };
  }

  function importAll(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('Invalid file');
    if (Array.isArray(payload.customers)) write(KEYS.customers, payload.customers);
    if (Array.isArray(payload.jobs)) write(KEYS.jobs, payload.jobs);
    if (Array.isArray(payload.companies)) write(KEYS.companies, payload.companies);
    if (payload.settings) write(KEYS.settings, payload.settings);
  }

  // Backfill companyId on jobs that pre-date multi-company support
  function migrateJobs() {
    const jobs = getJobs();
    const companies = getCompanies();
    if (companies.length === 0) return;
    const defaultId = companies[0].id;
    const fflId = companies.find(c => c.id === 'freshforless')?.id;
    let changed = false;
    jobs.forEach((j, idx) => {
      if (!j.companyId) {
        // Spread legacy seed data across both companies for a useful demo
        j.companyId = (fflId && idx % 2 === 1) ? fflId : defaultId;
        changed = true;
      }
    });
    if (changed) write(KEYS.jobs, jobs);
  }

  // --- Seed sample data on first run ---
  function seedIfEmpty() {
    // Always ensure default companies exist
    getCompanies();
    migrateJobs();

    if (getCustomers().length > 0 || getJobs().length > 0) return;

    const companies = getCompanies();
    const wirralId = companies[0].id;
    const fflId = companies[1] ? companies[1].id : wirralId;

    const c1 = saveCustomer({
      name: 'Margaret Thompson',
      phone: '07700 900123',
      email: 'mthompson@example.co.uk',
      address: '14 Elm Avenue',
      city: 'Birkenhead',
      postcode: 'CH41 5AB',
      notes: 'Two cats — please use pet-safe products. Side gate code: 4827.',
    });

    const c2 = saveCustomer({
      name: 'James Patel',
      phone: '07700 900456',
      email: 'james.patel@example.com',
      address: '22 Oakwood Drive',
      city: 'Wallasey',
      postcode: 'CH44 2XY',
      notes: 'Wool carpets in lounge — no harsh chemicals.',
    });

    const c3 = saveCustomer({
      name: 'Sarah Davies',
      phone: '07700 900789',
      email: '',
      address: '8 Riverside Court',
      city: 'Heswall',
      postcode: 'CH60 9PL',
      notes: '',
    });

    const today = new Date();
    const fmt = d => d.toISOString().slice(0, 10);
    const future = days => { const d = new Date(today); d.setDate(d.getDate() + days); return fmt(d); };

    saveJob({
      customerId: c1.id,
      companyId: wirralId,
      status: 'booked',
      date: future(3),
      time: '09:30',
      items: [
        { description: 'Lounge carpet (large)', qty: 1, price: 80 },
        { description: 'Hallway & stairs', qty: 1, price: 65 },
        { description: '3-seater sofa (fabric)', qty: 1, price: 75 },
      ],
      notes: 'Bring spot treatment for red wine stain by hearth.',
    });

    saveJob({
      customerId: c2.id,
      companyId: fflId,
      status: 'quoted',
      date: future(7),
      time: '14:00',
      items: [
        { description: 'Lounge wool carpet', qty: 1, price: 95 },
        { description: 'Master bedroom carpet', qty: 1, price: 55 },
      ],
      notes: '',
    });

    saveJob({
      customerId: c3.id,
      companyId: fflId,
      status: 'lead',
      date: '',
      time: '',
      items: [
        { description: '2-seater sofa', qty: 1, price: 55 },
      ],
      notes: 'Asked for callback Tuesday afternoon.',
    });

    saveJob({
      customerId: c1.id,
      companyId: wirralId,
      status: 'completed',
      date: future(-14),
      time: '10:00',
      items: [
        { description: 'Dining room carpet', qty: 1, price: 60 },
      ],
      notes: '',
    });

    saveJob({
      customerId: c2.id,
      companyId: wirralId,
      status: 'invoiced',
      date: future(-21),
      time: '11:00',
      items: [
        { description: 'Stairs & landing', qty: 1, price: 75 },
        { description: 'Armchair (fabric)', qty: 2, price: 35 },
      ],
      notes: '',
    });
  }

  return {
    getCompanies, getCompany, saveCompany,
    getCustomers, getCustomer, saveCustomer, deleteCustomer,
    getJobs, getJob, getJobsForCustomer, saveJob, updateJobStatus, deleteJob,
    getSettings, saveSettings,
    getActiveCompanyFilter, setActiveCompanyFilter,
    exportAll, importAll,
    seedIfEmpty, uid,
  };
})();
