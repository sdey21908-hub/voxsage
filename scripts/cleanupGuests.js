import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function purgeStaleGuests() {
  console.log('🔍 Checking for stale guest accounts older than 24 hours...');

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Find guest profiles older than 24 hours
  const { data: staleGuests, error: fetchErr } = await sb
    .from('profiles')
    .select('id, email, created_at')
    .eq('is_guest', true)
    .lt('created_at', cutoff);

  if (fetchErr) {
    console.error('Failed to query stale guests:', fetchErr.message);
    process.exit(1);
  }

  if (!staleGuests || staleGuests.length === 0) {
    console.log('✅ No stale guest accounts found.');
    process.exit(0);
  }

  console.log(`Found ${staleGuests.length} stale guest account(s). Purging...`);

  for (const guest of staleGuests) {
    const { error: delErr } = await sb.auth.admin.deleteUser(guest.id);
    if (delErr) {
      console.warn(`⚠️ Could not delete auth user ${guest.id}:`, delErr.message);
    } else {
      console.log(`🗑️ Deleted guest user: ${guest.email}`);
    }
  }

  console.log('✅ Stale guest cleanup completed successfully.');
  process.exit(0);
}

purgeStaleGuests();
