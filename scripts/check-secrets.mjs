// Fails the build if any secret ends up in the published site (dist/). Runs automatically after `pnpm build`.
// Two checks:
//   1. Values: environment variables (the shell, the host's build settings, local .env / .dev.vars files, including
//      the reminder worker's) whose names look sensitive must not appear anywhere in the output.
//   2. Shapes: well-known token formats (GitHub, AWS, Stripe, Slack, Google, private keys, Cloudflare deploy hooks)
//      must not appear either, whatever their source. The code viewers republish whole repositories, so this also
//      catches a key someone committed to one of them.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SENSITIVE = /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|API_?KEY|CLIENT_ID|REFRESH|AUTH|CREDENTIAL)/i;
const values = new Map();
const add = (k, v) => { if (SENSITIVE.test(k) && typeof v === 'string' && v.trim().length >= 6) values.set(k, v.trim()); };

for (const [k, v] of Object.entries(process.env)) add(k, v);
for (const f of ['.env', '.env.local', '.env.production', '.dev.vars', 'workers/reminders/.dev.vars']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) add(m[1], m[2].replace(/^['"]|['"]$/g, ''));
  }
}

const files = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p); } };
if (existsSync('dist')) walk('dist');

const SHAPES = [
  ['GitHub token', /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Stripe key', /\b[rs]k_live_[0-9A-Za-z]{20,}\b/],
  ['Slack token', /\bxox[abposr]-[0-9A-Za-z-]{20,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Private key', /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY( BLOCK)?-----/],
  ['Cloudflare deploy hook', /deploy_hooks\/[0-9a-f-]{30,}/],
];
const leaks = [];
for (const f of files) {
  const text = readFileSync(f).toString('latin1');
  for (const [k, v] of values) if (text.includes(v)) leaks.push(`${k} found in ${f}`);
  for (const [name, re] of SHAPES) if (re.test(text)) leaks.push(`something shaped like a ${name} in ${f}`);
}
if (leaks.length) { console.error('\n[check-secrets] SECRET VALUES FOUND IN BUILD OUTPUT:\n  ' + leaks.join('\n  ') + '\n'); process.exit(1); }
console.log(`[check-secrets] ok: ${values.size} sensitive variable(s) and ${SHAPES.length} token formats checked against ${files.length} output file(s).`);
