// Multi-tenant data layer backed by Supabase + an in-memory cache.
//
// Mutations (saveJob, saveCustomer, etc.) are async and write to Supabase, then
// update the cache. Getters stay synchronous and read from the cache so the UI
// modules don't have to async/await every render. Call Store.refresh() to hydrate
// the cache (done on login + after import).

const Store = (() => {
  const LEGACY_KEYS = {
    customers: 'crm.customers',
    jobs: 'crm.jobs',
    settings: 'crm.settings',
    companies: 'crm.companies',
  };

  const PALETTE = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#db2777', '#ca8a04'];

  let cache = {
    companies: [],
    customers: [],
    jobs: [],
    settings: { next_invoice_no: 1001, next_quote_no: 2001, active_company_filter: 'all' },
    activeFilter: 'all',
  };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function s() { return Supa.client; }
  function userId() { return Supa.user()?.id; }

  // ---- Job item shape conversion (DB uses snake_case, app uses camelCase) ----

  function jobFromDb(r) {
    if (!r) return r;
    return {
      id: r.id,
      customerId: r.customer_id,
      companyId: r.company_id,
      status: r.status,
      date: r.date || '',
      source: r.source || '',
      notes: r.notes || '',
      items: r.items || [],
      invoiceNo: r.invoice_no,
      quoteNo: r.quote_no,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    };
  }

  function jobToDb(j) {
    return {
      customer_id: j.customerId || null,
      company_id: j.companyId || null,
      status: j.status || 'lead',
      date: j.date || null,
      source: j.source || null,
      notes: j.notes || '',
      items: j.items || [],
      invoice_no: j.invoiceNo || null,
      quote_no: j.quoteNo || null,
    };
  }

  function companyFromDb(r) {
    return {
      id: r.id,
      name: r.name,
      shortName: r.short_name || '',
      color: r.color || '#2563eb',
      logo: r.logo || '',
      phone: r.phone || '',
      email: r.email || '',
      address: r.address || '',
      vatNumber: r.vat_number || '',
    };
  }

  function companyToDb(c) {
    return {
      name: c.name,
      short_name: c.shortName || null,
      color: c.color || null,
      logo: c.logo || null,
      phone: c.phone || null,
      email: c.email || null,
      address: c.address || null,
      vat_number: c.vatNumber || null,
    };
  }

  function customerFromDb(r) {
    return {
      id: r.id,
      name: r.name,
      phone: r.phone || '',
      email: r.email || '',
      address: r.address || '',
      city: r.city || '',
      postcode: r.postcode || '',
      notes: r.notes || '',
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    };
  }

  function customerToDb(c) {
    return {
      name: c.name,
      phone: c.phone || null,
      email: c.email || null,
      address: c.address || null,
      city: c.city || null,
      postcode: c.postcode || null,
      notes: c.notes || null,
    };
  }

  // ---- Cache hydration ----

  async function refresh() {
    if (!s() || !userId()) return;
    const [cs, cu, jb, st] = await Promise.all([
      s().from('companies').select('*').order('created_at'),
      s().from('customers').select('*').order('created_at'),
      s().from('jobs').select('*'),
      s().from('user_settings').select('*').eq('user_id', userId()).maybeSingle(),
    ]);
    if (cs.error) console.error('companies', cs.error);
    if (cu.error) console.error('customers', cu.error);
    if (jb.error) console.error('jobs', jb.error);
    if (st.error) console.error('settings', st.error);
    cache.companies = (cs.data || []).map(companyFromDb);
    cache.customers = (cu.data || []).map(customerFromDb);
    cache.jobs = (jb.data || []).map(jobFromDb);
    if (st.data) {
      cache.settings = st.data;
      cache.activeFilter = st.data.active_company_filter || 'all';
    }

    // First-run: ensure at least one company exists so the kanban + quote view
    // have something to render against.
    if (cache.companies.length === 0) {
      await saveCompany({
        name: 'My Business',
        shortName: 'My Biz',
        color: PALETTE[0],
      });
    }
  }

  function reset() {
    cache = {
      companies: [],
      customers: [],
      jobs: [],
      settings: { next_invoice_no: 1001, next_quote_no: 2001, active_company_filter: 'all' },
      activeFilter: 'all',
    };
  }

  // ---- Companies ----

  function getCompanies() { return cache.companies.slice(); }
  function getCompany(id) { return cache.companies.find(c => c.id === id); }

  async function saveCompany(data) {
    const payload = companyToDb(data);
    if (data.id) {
      const { data: row, error } = await s().from('companies').update(payload).eq('id', data.id).select().single();
      if (error) throw error;
      const i = cache.companies.findIndex(c => c.id === data.id);
      if (i >= 0) cache.companies[i] = companyFromDb(row);
      return cache.companies[i];
    }
    const { data: row, error } = await s().from('companies').insert(payload).select().single();
    if (error) throw error;
    const company = companyFromDb(row);
    cache.companies.push(company);
    return company;
  }

  async function deleteCompany(id) {
    const { error } = await s().from('companies').delete().eq('id', id);
    if (error) throw error;
    cache.companies = cache.companies.filter(c => c.id !== id);
  }

  // ---- Customers ----

  function getCustomers() { return cache.customers.slice(); }
  function getCustomer(id) { return cache.customers.find(c => c.id === id); }

  async function saveCustomer(data) {
    const payload = customerToDb(data);
    if (data.id) {
      const { data: row, error } = await s().from('customers').update(payload).eq('id', data.id).select().single();
      if (error) throw error;
      const i = cache.customers.findIndex(c => c.id === data.id);
      if (i >= 0) cache.customers[i] = customerFromDb(row);
      return cache.customers[i];
    }
    const { data: row, error } = await s().from('customers').insert(payload).select().single();
    if (error) throw error;
    const customer = customerFromDb(row);
    cache.customers.push(customer);
    return customer;
  }

  async function deleteCustomer(id) {
    const { error } = await s().from('customers').delete().eq('id', id);
    if (error) throw error;
    cache.customers = cache.customers.filter(c => c.id !== id);
  }

  // ---- Jobs ----

  function getJobs() { return cache.jobs.slice(); }
  function getJob(id) { return cache.jobs.find(j => j.id === id); }
  function getJobsForCustomer(customerId) { return cache.jobs.filter(j => j.customerId === customerId); }

  async function saveJob(data) {
    const payload = jobToDb(data);
    if (data.id) {
      const { data: row, error } = await s().from('jobs').update(payload).eq('id', data.id).select().single();
      if (error) throw error;
      const i = cache.jobs.findIndex(j => j.id === data.id);
      if (i >= 0) cache.jobs[i] = jobFromDb(row);
      return cache.jobs[i];
    }
    const { data: row, error } = await s().from('jobs').insert(payload).select().single();
    if (error) throw error;
    const job = jobFromDb(row);
    cache.jobs.push(job);
    return job;
  }

  async function updateJobStatus(id, status) {
    const job = getJob(id);
    if (!job) return null;
    const update = { status };
    if (status === 'invoiced' && !job.invoiceNo) {
      update.invoice_no = cache.settings.next_invoice_no || 1001;
      cache.settings.next_invoice_no = update.invoice_no + 1;
      await s().from('user_settings').update({ next_invoice_no: cache.settings.next_invoice_no }).eq('user_id', userId());
    }
    if (status === 'quoted' && !job.quoteNo) {
      update.quote_no = cache.settings.next_quote_no || 2001;
      cache.settings.next_quote_no = update.quote_no + 1;
      await s().from('user_settings').update({ next_quote_no: cache.settings.next_quote_no }).eq('user_id', userId());
    }
    const { data: row, error } = await s().from('jobs').update(update).eq('id', id).select().single();
    if (error) throw error;
    const updated = jobFromDb(row);
    const i = cache.jobs.findIndex(j => j.id === id);
    if (i >= 0) cache.jobs[i] = updated;
    return updated;
  }

  async function deleteJob(id) {
    const { error } = await s().from('jobs').delete().eq('id', id);
    if (error) throw error;
    cache.jobs = cache.jobs.filter(j => j.id !== id);
  }

  // ---- Settings / filter ----

  function getSettings() {
    return {
      nextInvoiceNo: cache.settings.next_invoice_no || 1001,
      nextQuoteNo: cache.settings.next_quote_no || 2001,
      activeCompanyFilter: cache.activeFilter,
    };
  }

  function getActiveCompanyFilter() { return cache.activeFilter; }

  async function setActiveCompanyFilter(id) {
    cache.activeFilter = id;
    if (userId()) {
      await s().from('user_settings').update({ active_company_filter: id }).eq('user_id', userId());
    }
  }

  // ---- Export / import ----

  function exportAll() {
    return {
      companies: cache.companies,
      customers: cache.customers,
      jobs: cache.jobs,
      settings: getSettings(),
      exportedAt: new Date().toISOString(),
      version: 3,
    };
  }

  async function importAll(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('Invalid file');
    // Replace strategy: wipe current cloud data, then insert payload.
    // Done in series because we need new ids and to remap.
    await s().from('jobs').delete().not('id', 'is', null);
    await s().from('customers').delete().not('id', 'is', null);
    await s().from('companies').delete().not('id', 'is', null);

    const companyMap = {};
    for (const c of (payload.companies || [])) {
      const saved = await saveCompany({ ...c, id: undefined });
      companyMap[c.id] = saved.id;
    }
    const customerMap = {};
    for (const c of (payload.customers || [])) {
      const saved = await saveCustomer({ ...c, id: undefined });
      customerMap[c.id] = saved.id;
    }
    for (const j of (payload.jobs || [])) {
      await saveJob({
        ...j,
        id: undefined,
        customerId: customerMap[j.customerId] || null,
        companyId: companyMap[j.companyId] || null,
      });
    }
    await refresh();
  }

  // ---- Detect legacy localStorage data for one-time migration prompt ----

  function legacyDataAvailable() {
    try {
      const customers = JSON.parse(localStorage.getItem(LEGACY_KEYS.customers) || '[]');
      const jobs = JSON.parse(localStorage.getItem(LEGACY_KEYS.jobs) || '[]');
      return (customers.length + jobs.length) > 0
        && !localStorage.getItem('crm.legacyImported');
    } catch { return false; }
  }

  async function importLegacy() {
    const customers = JSON.parse(localStorage.getItem(LEGACY_KEYS.customers) || '[]');
    const jobs = JSON.parse(localStorage.getItem(LEGACY_KEYS.jobs) || '[]');
    const companies = JSON.parse(localStorage.getItem(LEGACY_KEYS.companies) || '[]');

    // Wipe any auto-created starter company so we don't end up with duplicates.
    await s().from('companies').delete().not('id', 'is', null);

    const companyMap = {};
    for (const c of companies) {
      const saved = await saveCompany({
        name: c.name,
        shortName: c.shortName,
        color: c.color,
        logo: c.logo,
        phone: c.phone,
        email: c.email,
        address: c.address,
        vatNumber: c.vatNumber,
      });
      companyMap[c.id] = saved.id;
    }

    const customerMap = {};
    for (const c of customers) {
      const saved = await saveCustomer({
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        city: c.city,
        postcode: c.postcode,
        notes: c.notes,
      });
      customerMap[c.id] = saved.id;
    }

    for (const j of jobs) {
      await saveJob({
        customerId: customerMap[j.customerId] || null,
        companyId: companyMap[j.companyId] || null,
        status: j.status || 'lead',
        date: j.date || null,
        source: j.source || null,
        notes: j.notes || '',
        items: j.items || [],
      });
    }

    localStorage.setItem('crm.legacyImported', '1');
    await refresh();
    return { customers: customers.length, jobs: jobs.length, companies: companies.length };
  }

  return {
    refresh, reset, uid,
    getCompanies, getCompany, saveCompany, deleteCompany,
    getCustomers, getCustomer, saveCustomer, deleteCustomer,
    getJobs, getJob, getJobsForCustomer, saveJob, updateJobStatus, deleteJob,
    getSettings, getActiveCompanyFilter, setActiveCompanyFilter,
    exportAll, importAll,
    legacyDataAvailable, importLegacy,
  };
})();
