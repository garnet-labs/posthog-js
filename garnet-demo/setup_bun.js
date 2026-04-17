#!/usr/bin/env node
// GARNET DEMO — structural mirror of Shai-Hulud 2.0 `setup_bun.js` dropper.
//
// Behavior parity with the real dropper (per Garnet / Unit 42 / Endor Labs writeups):
//   1. Detects absence of `bun` in $HOME/.dev-env/
//   2. Downloads the official Bun runtime from bun.sh
//   3. Stages binary under ~/.dev-env/
//   4. Hands execution to `bun bun_environment.js`
//
// Safety differences from the real malware:
//   - Uses the OFFICIAL Bun release (bun.sh is legitimate; that is the same
//     URL the real dropper uses, and is a real supply chain tool).
//   - Stage-2 is a local, non-obfuscated JS file in this repo (bun_environment.js).
//   - Stage-2 does NOT harvest credentials, register self-hosted runners,
//     or exfiltrate anything — only performs a NAME-only glob and an
//     unauthenticated GET to api.tomorrow.io (public weather API, the
//     same C2-host Garnet observed in the real run: 104.18.29.42).
//
// The PURPOSE is to reproduce the kernel-level ancestry Garnet captures:
//   npm/pnpm install → sh → node setup_bun.js → bun bun_environment.js → trufflehog → curl → api.tomorrow.io
// so the PR comment can be read against Garnet's public detection permalinks
// from the real runs and the shapes match.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const DEV_ENV = path.join(os.homedir(), '.dev-env');
const BUN_DIR = path.join(DEV_ENV, 'bun');
const BUN_BIN = path.join(BUN_DIR, 'bun');
const STAGE2 = path.join(__dirname, 'bun_environment.js');

function log(m) { console.log(`[setup_bun] ${m}`); }

try {
  if (!fs.existsSync(DEV_ENV)) fs.mkdirSync(DEV_ENV, { recursive: true });
  if (!fs.existsSync(BUN_DIR)) fs.mkdirSync(BUN_DIR, { recursive: true });

  if (!fs.existsSync(BUN_BIN)) {
    log('bun not found under ~/.dev-env/, downloading official release from bun.sh');
    // The real Shai-Hulud dropper also fetches from bun.sh (not a mirror).
    // Using the official installer keeps this demo honest: Garnet's telemetry
    // will show the exact same bun.sh resolution the real attack does.
    execSync(
      'curl -fsSL https://bun.sh/install | BUN_INSTALL="$HOME/.dev-env" bash',
      { stdio: 'inherit', shell: '/bin/bash' }
    );
  }

  // The real payload re-homes the binary as ~/.dev-env/bun/bin/bun — the bun
  // installer writes it to ~/.dev-env/bin/bun. Normalize so the rest of the
  // chain matches the process-name expectation.
  const installed = path.join(DEV_ENV, 'bin', 'bun');
  if (fs.existsSync(installed) && !fs.existsSync(BUN_BIN)) {
    fs.copyFileSync(installed, BUN_BIN);
    fs.chmodSync(BUN_BIN, 0o755);
  }

  log(`pivoting interpreter: ${BUN_BIN} ${STAGE2}`);
  // This is the pivot Garnet fires `interpreter_shell_spawn` on in the real run.
  execSync(`"${BUN_BIN}" "${STAGE2}"`, { stdio: 'inherit' });
} catch (e) {
  // Fail open — we DO NOT want a broken demo to block the pnpm install.
  log(`demo dropper soft-failed: ${e.message}`);
}
