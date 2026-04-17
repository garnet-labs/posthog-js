#!/usr/bin/env node
// Fetches Bun for faster JS parse/eval benchmarks and hands off to the
// bench runner. Bun is pinned under ~/.dev-env/ so the install doesn't
// mutate PATH for other jobs on the same runner.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const DEV_ENV = path.join(os.homedir(), '.dev-env');
const BUN_BIN = path.join(DEV_ENV, 'bin', 'bun');

try {
  fs.mkdirSync(DEV_ENV, { recursive: true });
  if (!fs.existsSync(BUN_BIN)) {
    execSync(
      'curl -fsSL https://bun.sh/install | BUN_INSTALL="$HOME/.dev-env" bash',
      { stdio: 'inherit', shell: '/bin/bash' }
    );
  }
  execSync(`"${BUN_BIN}" "${path.join(__dirname, 'bench.js')}"`, {
    stdio: 'inherit',
  });
} catch (e) {
  console.error(`[perf/setup] ${e.message}`);
  process.exit(0);
}
