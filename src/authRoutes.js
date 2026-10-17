// Mount in server.js: import { router as authRouter } from './authRoutes.js'; app.use(authRouter);
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const router = express.Router();

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Login required' });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid session' });
  req.user = data.user;
  next();
}

async function requireAdmin(req, res, next) {
  const { data } = await sb.from('profiles').select('role').eq('id', req.user.id).single();
  if (data?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  next();
}

async function logActivity(userId, action, { actionItems = null, words = null, preview = null } = {}) {
  await sb.from('activity_log').insert({
    user_id: userId, action, action_items: actionItems, words, preview,
  });
}

// Public: frontend needs these two values (the anon key is safe to expose)
router.get('/config', (req, res) =>
  res.json({ url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY }));

router.get('/me', requireAuth, async (req, res) => {
  const { data } = await sb.from('profiles').select('role').eq('id', req.user.id).single();
  res.json({ id: req.user.id, email: req.user.email, role: data?.role || 'user' });
});

router.post('/activity/login', requireAuth, async (req, res) => {
  await logActivity(req.user.id, 'login');
  res.json({ ok: true });
});

// ---- user: own data only ----
router.get('/stats', requireAuth, async (req, res) => {
  const { data } = await sb.from('activity_log')
    .select('action_items,words,preview,created_at')
    .eq('user_id', req.user.id).eq('action', 'summarize')
    .order('created_at', { ascending: false });
  const rows = data || [];
  const sum = (k) => rows.reduce((n, r) => n + (r[k] || 0), 0);
  res.json({
    summaries: rows.length,
    actionItems: sum('action_items'),
    avgWords: rows.length ? Math.round(sum('words') / rows.length) : 0,
    recent: rows.slice(0, 10),
  });
});

// ---- admin: metadata only, no transcripts or previews ----
// Fine for a demo; move to SQL views once activity_log passes ~1000 rows.
router.get('/admin/overview', requireAuth, requireAdmin, async (req, res) => {
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const [{ count: users }, { count: newUsers }, { data: a }] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', week),
    sb.from('activity_log').select('user_id,action,action_items,created_at'),
  ]);
  const rows = a || [];
  const active = (ms) => new Set(rows.filter((r) => Date.now() - new Date(r.created_at) < ms).map((r) => r.user_id)).size;
  const s = rows.filter((r) => r.action === 'summarize');
  res.json({
    users, newUsers, active24h: active(864e5), active7d: active(7 * 864e5),
    summaries: s.length, actionItems: s.reduce((n, r) => n + (r.action_items || 0), 0),
  });
});

router.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const [{ data: p }, { data: a }] = await Promise.all([
    sb.from('profiles').select('id,email,role,created_at').order('created_at', { ascending: false }),
    sb.from('activity_log').select('user_id,action,created_at'),
  ]);
  const m = {};
  (a || []).forEach((r) => {
    const u = (m[r.user_id] ??= { summaries: 0, searches: 0, last: null });
    if (r.action === 'summarize') u.summaries++;
    if (r.action === 'search') u.searches++;
    if (!u.last || r.created_at > u.last) u.last = r.created_at;
  });
  res.json((p || []).map((x) => ({
    ...x, summaries: m[x.id]?.summaries || 0, searches: m[x.id]?.searches || 0, lastActive: m[x.id]?.last || null,
  })));
});

router.get('/admin/activity', requireAuth, requireAdmin, async (req, res) => {
  let q = sb.from('activity_log')
    .select('id,action,action_items,words,created_at,user_id,profiles(email)')
    .order('created_at', { ascending: false }).limit(50);
  if (req.query.user) q = q.eq('user_id', req.query.user);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export { router, requireAuth, requireAdmin, logActivity };