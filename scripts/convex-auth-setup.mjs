// One-time Convex Auth setup for the production deployment, run from GitHub Actions.
// Generates the JWT signing key pair (like `npx @convex-dev/auth` does) and sets
// JWT_PRIVATE_KEY, JWKS and SITE_URL on the deployment named by CONVEX_DEPLOY_KEY.
// The private key is passed straight to the Convex CLI and never printed.
import { execFileSync } from 'node:child_process';
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';

const siteUrl = process.env.SITE_URL;
const force = process.env.FORCE === 'true';
const dryRun = process.argv.includes('--dry-run');
if (!siteUrl) throw new Error('SITE_URL is required');
if (!dryRun && !process.env.CONVEX_DEPLOY_KEY) throw new Error('CONVEX_DEPLOY_KEY secret is missing');

const convex = (...args) => execFileSync('npx', ['convex', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const isSet = (name) => {
  try {
    return convex('env', 'get', name).trim() !== '';
  } catch {
    return false;
  }
};

const keys = await generateKeyPair('RS256', { extractable: true });
const JWT_PRIVATE_KEY = (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, ' ');
const JWKS = JSON.stringify({ keys: [{ use: 'sig', ...(await exportJWK(keys.publicKey)) }] });

if (dryRun) {
  console.log('dry run: key pair generated', { privateKeyChars: JWT_PRIVATE_KEY.length, jwksChars: JWKS.length, siteUrl });
  process.exit(0);
}

if (!force && isSet('JWKS')) {
  console.log('JWT keys already set – skipping (run with "force" to rotate; this signs everyone out).');
} else {
  // "--" so values starting with "-----BEGIN" aren't parsed as CLI options.
  convex('env', 'set', '--force', 'JWT_PRIVATE_KEY', '--', JWT_PRIVATE_KEY);
  convex('env', 'set', '--force', 'JWKS', '--', JWKS);
  console.log('Set JWT_PRIVATE_KEY and JWKS.');
}
convex('env', 'set', '--force', 'SITE_URL', '--', siteUrl);
console.log(`Set SITE_URL=${siteUrl}`);
