// Local-first persistence layer. Stores customers + jobs in localStorage as JSON.
// Single source of truth — every page reads through Store.

const Store = (() => {
  const KEYS = {
    customers: 'crm.customers',
    jobs: 'crm.jobs',
    settings: 'crm.settings',
  };

  const DEFAULT_SETTINGS = {
    businessName: 'Carpet & Upholstery Cleaning',
    businessPhone: '',
    businessEmail: '',
    businessAddress: '',
    vatNumber: '',
    nextInvoiceNo: 1001,
    nextQuoteNo: 2001,
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
    // Cascade: also remove jobs for that customer? No — keep history but flag.
    // We'll just leave jobs orphaned-by-id; the UI shows "Unknown customer".
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

  // --- Settings ---
  function getSettings() {
    return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
  }

  function saveSettings(data) {
    write(KEYS.settings, data);
    return data;
  }

  // --- Export / import ---
  function exportAll() {
    return {
      customers: getCustomers(),
      jobs: getJobs(),
      settings: getSettings(),
      exportedAt: new Date().toISOString(),
      version: 1,
    };
  }

  function importAll(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('Invalid file');
    if (Array.isArray(payload.customers)) write(KEYS.customers, payload.customers);
    if (Array.isArray(payload.jobs)) write(KEYS.jobs, payload.jobs);
    if (payload.settings) write(KEYS.settings, payload.settings);
  }

  // --- Seed sample data on first run ---
  function seedIfEmpty() {
    if (getCustomers().length > 0 || getJobs().length > 0) return;

    const c1 = saveCustomer({
      name: 'Margaret Thompson',
      phone: '07700 900123',
      email: 'mthompson@example.co.uk',
      address: '14 Elm Avenue',
      city: 'Reading',
      postcode: 'RG1 5AB',
      notes: 'Two cats — please use pet-safe products. Side gate code: 4827.',
    });

    const c2 = saveCustomer({
      name: 'James Patel',
      phone: '07700 900456',
      email: 'james.patel@example.com',
      address: '22 Oakwood Drive',
      city: 'Wokingham',
      postcode: 'RG40 2XY',
      notes: 'Wool carpets in lounge — no harsh chemicals.',
    });

    const c3 = saveCustomer({
      name: 'Sarah Davies',
      phone: '07700 900789',
      email: '',
      address: '8 Riverside Court',
      city: 'Reading',
      postcode: 'RG2 9PL',
      notes: '',
    });

    const today = new Date();
    const fmt = d => d.toISOString().slice(0, 10);
    const future = days => { const d = new Date(today); d.setDate(d.getDate() + days); return fmt(d); };

    saveJob({
      customerId: c1.id,
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
    getCustomers, getCustomer, saveCustomer, deleteCustomer,
    getJobs, getJob, getJobsForCustomer, saveJob, updateJobStatus, deleteJob,
    getSettings, saveSettings,
    exportAll, importAll,
    seedIfEmpty, uid,
  };
})();
