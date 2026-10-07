// One-time Convex Auth setup for the production deployment, run from GitHub Actions.
// Generates the JWT signing key pair (like `npx @convex-dev/auth` does) and sets
// JWT_PRIVATE_KEY, JWKS and SITE_URL on the deployment named by CONVEX_DEPLOY_KEY.
//
// Secrets must never reach the log: values are passed to the Convex CLI through a
// private temp file (never as command-line arguments, which Node prints when a
// command fails), masked for GitHub Actions, and errors are reported without the
// command line.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';

class SetupError extends Error {}

const siteUrl = process.env.SITE_URL;
const force = process.env.FORCE === 'true';
const dryRun = process.argv.includes('--dry-run');
const deployKey = process.env.CONVEX_DEPLOY_KEY ?? '';

const dir = mkdtempSync(join(process.env.RUNNER_TEMP ?? tmpdir(), 'convex-auth-'));
try {
  checkInputs();

  const keys = await generateKeyPair('RS256', { extractable: true });
  const JWT_PRIVATE_KEY = (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, ' ');
  const JWKS = JSON.stringify({ keys: [{ use: 'sig', ...(await exportJWK(keys.publicKey)) }] });
  if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${JWT_PRIVATE_KEY}`);

  if (dryRun) {
    console.log('dry run: key pair generated', { privateKeyChars: JWT_PRIVATE_KEY.length, jwksChars: JWKS.length, siteUrl });
  } else {
    if (!force && isSet('JWKS')) {
      console.log('JWT keys already set – skipping (run with "force" to rotate; this signs everyone out).');
    } else {
      setVar('JWT_PRIVATE_KEY', JWT_PRIVATE_KEY);
      setVar('JWKS', JWKS);
      console.log('Set JWT_PRIVATE_KEY and JWKS.');
    }
    setVar('SITE_URL', siteUrl);
    console.log(`Set SITE_URL=${siteUrl}`);
  }
} catch (e) {
  report(e instanceof SetupError ? e.message : 'Unexpected error (details withheld so no secret can leak).');
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}

function checkInputs() {
  if (!siteUrl) throw new SetupError('SITE_URL is required.');
  if (dryRun) return;
  if (!deployKey) throw new SetupError('The CONVEX_DEPLOY_KEY secret is missing.');
  if (!deployKey.startsWith('prod:')) {
    const kind = deployKey.split(':')[0] || 'unknown';
    throw new SetupError(
      `CONVEX_DEPLOY_KEY is a "${kind}" key, but a production key is required (it starts with "prod:"). ` +
        'In the Convex dashboard open the Production deployment → Settings → Generate Production Deploy Key, ' +
        'then replace the GitHub secret.',
    );
  }
}

function isSet(name) {
  try {
    const out = execFileSync('npx', ['convex', 'env', 'get', name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim() !== '';
  } catch {
    return false;
  }
}

function setVar(name, value) {
  const file = join(dir, name);
  writeFileSync(file, value, { mode: 0o600 });
  try {
    execFileSync('npx', ['convex', 'env', 'set', '--force', name, '--from-file', file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    // Never rethrow the original error: its message contains the full command line.
    const stderr = String(e.stderr ?? '').trim();
    throw new SetupError(`Setting ${name} failed.${stderr ? `\n${stderr}` : ''}`);
  }
}

function report(message) {
  console.error(`::error::${message.split('\n')[0]}`);
  console.error(message);
}
