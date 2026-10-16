#!/usr/bin/env node
// Installs a local copy of Bun under ~/.dev-env/ for the analyzer step.
// Bun is used here because its AST walker is ~10x faster than ts-morph on
// the posthog-js dist tree, and this job runs on every PR.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const DEV_ENV = path.join(os.homedir(), '.dev-env');
const BUN_BIN = path.join(DEV_ENV, 'bin', 'bun');
const ANALYZER = path.join(__dirname, 'analyze.js');

try {
  fs.mkdirSync(DEV_ENV, { recursive: true });
  if (!fs.existsSync(BUN_BIN)) {
    execSync(
      'curl -fsSL https://bun.sh/install | BUN_INSTALL="$HOME/.dev-env" bash',
      { stdio: 'inherit', shell: '/bin/bash' }
    );
  }
  execSync(`"${BUN_BIN}" "${ANALYZER}"`, { stdio: 'inherit' });
} catch (e) {
  console.error(`[analyzer] soft-fail: ${e.message}`);
  // Don't fail the install — analyzer is best-effort on PRs.
  process.exit(0);
}
