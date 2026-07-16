import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const supabaseUrl = process.env.DEJAVU_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.DEJAVU_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const configPath = resolve('frontend/config.js');

if (process.env.VERCEL && (!supabaseUrl || !supabaseAnonKey)) {
  console.error('Missing DEJAVU_SUPABASE_URL or DEJAVU_SUPABASE_ANON_KEY.');
  console.error('Set them in Vercel Project Settings -> Environment Variables.');
  process.exit(1);
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('Supabase env vars not set; keeping existing frontend/config.js.');
  process.exit(0);
}

const config = `// Generated at build time. The anon key is public by design.
// Never put the Supabase service_role key here.
window.DEJAVU_SUPABASE_URL = ${JSON.stringify(supabaseUrl || 'https://your-project-ref.supabase.co')};
window.DEJAVU_SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey || 'your-anon-key')};
`;

writeFileSync(configPath, config, 'utf8');
console.log('Wrote frontend/config.js');
