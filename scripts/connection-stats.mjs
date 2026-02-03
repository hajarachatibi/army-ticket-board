#!/usr/bin/env node
/**
 * Prints connection stats: active count, waiting list count, and count by stage.
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 * (e.g. from .env.local or export before running).
 *
 * Run: node scripts/connection-stats.mjs
 * Or with env: node -e "require('fs').readFileSync('.env.local','utf8').split('\n').forEach(l=>{const i=l.indexOf('=');if(i>0) process.env[l.slice(0,i).trim()]=l.slice(i+1).trim()}); require('./scripts/connection-stats.mjs')"
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them or run scripts/connection-stats.sql in Supabase SQL Editor.');
  process.exit(1);
}

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase.rpc('get_connection_stats');
if (error) {
  console.error('RPC error:', error.message);
  console.error('Ensure migration 118_connection_stats_rpc.sql is applied, or run scripts/connection-stats.sql in Supabase SQL Editor.');
  process.exit(1);
}

const stats = data;
console.log('Connection stats\n');
console.log('  Active connections:  ', Number(stats.active_connections ?? 0));
console.log('  Waiting list (pending_seller):', Number(stats.waiting_list_count ?? 0));
console.log('\nBy stage:');
const byStage = stats.by_stage ?? {};
const stages = Object.keys(byStage).sort();
if (stages.length === 0) {
  console.log('  (none)');
} else {
  for (const stage of stages) {
    console.log('  ', stage.padEnd(18), String(byStage[stage]));
  }
}
console.log('');
