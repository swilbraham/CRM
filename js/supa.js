// Thin wrapper over the Supabase client. Initialised once at startup.
// Exposes the underlying client at Supa.client and helpers used by other modules.

const Supa = (() => {
  let client = null;
  let currentUser = null;
  let onAuthChange = null;

  function init() {
    if (!window.supabase || !window.supabase.createClient) {
      console.error('Supabase JS SDK failed to load');
      return null;
    }
    client = window.supabase.createClient(SUPA_CONFIG.url, SUPA_CONFIG.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    client.auth.onAuthStateChange((event, session) => {
      currentUser = session ? session.user : null;
      if (onAuthChange) onAuthChange(currentUser);
    });
    return client;
  }

  async function getCurrentUser() {
    if (!client) return null;
    const { data } = await client.auth.getUser();
    currentUser = data?.user || null;
    return currentUser;
  }

  function user() { return currentUser; }

  async function signUp(email, password) {
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await client.auth.signOut();
  }

  function setAuthChangeHandler(fn) { onAuthChange = fn; }

  return {
    init,
    get client() { return client; },
    user, getCurrentUser,
    signUp, signIn, signOut,
    setAuthChangeHandler,
  };
})();
