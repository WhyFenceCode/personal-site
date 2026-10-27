// Fails the build if any secret value ends up in the published site (dist/).
// Secrets = environment variables (from the shell, your host's build settings, or local .env / .dev.vars files)
// whose names look sensitive. Runs automatically after `pnpm build`.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SENSITIVE = /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|API_?KEY|CLIENT_ID|REFRESH|AUTH|CREDENTIAL)/i;
const values = new Map();
const add = (k, v) => { if (SENSITIVE.test(k) && typeof v === 'string' && v.trim().length >= 6) values.set(k, v.trim()); };

for (const [k, v] of Object.entries(process.env)) add(k, v);
for (const f of ['.env', '.env.local', '.env.production', '.dev.vars']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) add(m[1], m[2].replace(/^['"]|['"]$/g, ''));
  }
}

const files = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p); } };
if (existsSync('dist')) walk('dist');

const leaks = [];
for (const f of files) {
  const text = readFileSync(f).toString('latin1');
  for (const [k, v] of values) if (text.includes(v)) leaks.push(`${k} found in ${f}`);
}
if (leaks.length) { console.error('\n[check-secrets] SECRET VALUES FOUND IN BUILD OUTPUT:\n  ' + leaks.join('\n  ') + '\n'); process.exit(1); }
console.log(`[check-secrets] ok: ${values.size} sensitive variable(s) checked against ${files.length} output file(s).`);
