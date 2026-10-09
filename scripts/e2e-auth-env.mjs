// Gives the throwaway local e2e backend its own Convex Auth signing keys. Refuses to touch
// any deployment that isn't local, so it can never rotate real keys.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';

const env = readFileSync('.env.local', 'utf8');
const deployment = /^CONVEX_DEPLOYMENT=(\S+)/m.exec(env)?.[1] ?? '';
if (!/^(anonymous|local):/.test(deployment)) {
  console.error(`Refusing to set auth keys on non-local deployment "${deployment.split(':')[0]}".`);
  process.exit(1);
}
const keys = await generateKeyPair('RS256', { extractable: true });
const vars = {
  JWT_PRIVATE_KEY: (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, ' '),
  JWKS: JSON.stringify({ keys: [{ use: 'sig', ...(await exportJWK(keys.publicKey)) }] }),
  SITE_URL: 'http://localhost:4173',
};
for (const [name, value] of Object.entries(vars)) {
  execFileSync('npx', ['convex', 'env', 'set', name, '--', value], { stdio: ['ignore', 'ignore', 'inherit'] });
}
console.log('Local e2e backend: auth keys set.');
