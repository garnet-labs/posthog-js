#!/usr/bin/env bun
// GARNET DEMO — stage-2 payload invoked under the Bun interpreter, mirroring
// Shai-Hulud 2.0's `bun_environment.js`.
//
// Real malware at this point: downloads TruffleHog, scans $HOME, validates
// secrets against live APIs, probes IMDS (169.254.169.254), attempts Azure
// token grab, registers a rogue self-hosted runner, exfils to api.tomorrow.io.
//
// Demo payload: drops a shell script NAMED `trufflehog` into ~/.dev-env/ so the
// process-name label in Garnet's ancestry matches the real detection's leaf
// node, and executes it. That script does a NAME-only credential-file glob
// (no reads, no contents) and issues one unauthenticated GET to
// https://api.tomorrow.io/v4/weather/realtime — the same public weather-API
// C2 host Garnet captured in the real run (IP 104.18.29.42).
//
// This is the minimal set of behaviors required to reproduce the shape of the
// real Garnet detection `credentials_files_access_2` at depth-N ancestry.

import { writeFileSync, chmodSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const DEV_ENV = join(homedir(), '.dev-env');
const TRUFFLER_CACHE = join(DEV_ENV, '.truffler-cache');
const TH_BIN = join(TRUFFLER_CACHE, 'trufflehog');

if (!existsSync(TRUFFLER_CACHE)) mkdirSync(TRUFFLER_CACHE, { recursive: true });

// Write a minimal shell script NAMED `trufflehog`. We do not ship the real
// TruffleHog binary — we only need the process name + egress shape.
const TH_SCRIPT = `#!/bin/bash
# GARNET DEMO — fake trufflehog. Name-only glob + single tomorrow.io GET.
# No file contents are read. No credentials are validated.

set +e
echo "[trufflehog-demo] starting credential file NAME scan under \\$HOME"
find "\\$HOME" -maxdepth 3 \\( \\
  -name ".npmrc" -o -name "*.env*" -o -name "*.pem" -o \\
  -name "credentials" -o -name "config.json" -o \\
  -name "application_default_credentials.json" -o -name "azureProfile.json" \\
  \\) 2>/dev/null | head -20 > /tmp/garnet-demo-globs.txt
echo "[trufflehog-demo] \\$(wc -l < /tmp/garnet-demo-globs.txt) credential-file names seen (names only, no reads)"

# Single egress to api.tomorrow.io — the same host Garnet observed in the
# real Nov 2025 Shai-Hulud run (event c1ea1dc1, IP 104.18.29.42).
# Unauthenticated; we expect a 401, which is fine — the telemetry artifact
# is the SNI+IP connection itself, not the response body.
echo "[trufflehog-demo] egress → api.tomorrow.io (parity with real run)"
curl -sS --max-time 10 -o /tmp/garnet-demo-tomorrow.json -w \\
  "tomorrow.io HTTP %{http_code} | remote %{remote_ip}\\n" \\
  "https://api.tomorrow.io/v4/weather/realtime?location=toronto" || true
`;

writeFileSync(TH_BIN, TH_SCRIPT);
chmodSync(TH_BIN, 0o755);

console.log(`[bun_environment] executing ${TH_BIN} (stage-3 trufflehog-shape leaf)`);
// This exec is the kernel-observable leaf of the ancestry chain.
// Garnet sees: bun → trufflehog → curl → api.tomorrow.io:443
const res = spawnSync(TH_BIN, [], { stdio: 'inherit' });
process.exit(res.status ?? 0);
