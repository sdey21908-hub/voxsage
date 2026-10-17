// Shared frontend helpers. Load after the supabase-js script tag.
let _client;
async function getClient() {
  if (_client) return _client;
  const cfg = await (await fetch('/config')).json();
  _client = supabase.createClient(cfg.url, cfg.anonKey);
  return _client;
}
async function authFetch(url, opts = {}) {
  const c = await getClient();
  const { data: { session } } = await c.auth.getSession();
  if (!session) { location.href = '/login.html'; throw new Error('Not logged in'); }
  const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + session.access_token } });
  if (r.status === 401) { location.href = '/login.html'; }
  return r;
}
async function requireRole(role) {
  const me = await (await authFetch('/me')).json();
  if (role === 'admin' && me.role !== 'admin') location.href = '/';
  return me;
}
async function logout() {
  const c = await getClient();
  await c.auth.signOut();
  location.href = '/login.html';
}