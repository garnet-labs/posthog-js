# Garnet Demo Harness

This directory and the companion workflow `.github/workflows/garnet-demo.yml`
exist **only** on `garnet-labs/posthog-js` — a fork of `PostHog/posthog-js`
used to demonstrate Garnet Runtime Visibility's baseline + deviation
detection inside PRs. Nothing here is part of posthog-js and it will never
be merged upstream.

## Why this shape

The payload is designed to reproduce the kernel-observable ancestry Garnet
captured from the actual Shai-Hulud 2.0 runs in November 2025, not a
generic supply-chain hypothetical. The real run profile Garnet published
(detection `c1ea1dc1-88b3-4255-9d5a-310ed7be97d2`) shows this tree:

```
systemd → hosted-compute-* → Runner.Listener → Runner.Worker
 → bash → npm install <pkg> → sh → node setup_bun.js
   → bun bun_environment.js → trufflehog → api.tomorrow.io:443
```

This demo reproduces every structural element of that tree:

| Element | Real Shai-Hulud 2.0 | This demo |
| --- | --- | --- |
| Entry point | `npm install @seung-ju/react-native-action-sheet` | `npm install` inside `garnet-demo/` |
| Trigger | `preinstall` lifecycle hook | `preinstall` lifecycle hook |
| Dropper | `setup_bun.js` | `setup_bun.js` |
| Runtime pivot | Node → Bun (fires `interpreter_shell_spawn`) | Node → Bun (real, from bun.sh) |
| Stage-2 | `bun bun_environment.js` | `bun bun_environment.js` |
| Stage-3 leaf | `trufflehog` binary under `~/.dev-env/.truffler-cache/` | shell script named `trufflehog` at the same path |
| C2 egress | `api.tomorrow.io:443` (104.18.29.42) | `api.tomorrow.io:443` (same host) |
| Credential file scan | TruffleHog reads `/home/runner` | `find` name-only glob, no reads |

## What is deliberately NOT reproduced (safety)

- No credential file **contents** are read. Only file-name globs via `find`.
- No real TruffleHog binary is installed or executed. We ship a shell
  script named `trufflehog` to reproduce the process-name label at the
  ancestry leaf — nothing else.
- No rogue GitHub Actions self-hosted runner is registered. The real
  worm downloads the Actions runner from `objects.githubusercontent.com`,
  calls `config.sh`, and backgrounds a `Runner.Listener` via `nohup`. This
  demo does none of that.
- No IMDS probe (`169.254.169.254`), no Azure CLI token request, no npm
  token exfiltration, no propagation to other packages.
- The egress to `api.tomorrow.io` is a single unauthenticated `GET` that
  returns HTTP 401. The domain is a real public weather API (owned by
  The Climate Corporation / Tomorrow.io) — the same legitimate-looking,
  Cloudflare-fronted host the real attacker abused as C2.

## Why Bun, really

Bun is a legitimate runtime from bun.sh. Installing it is not malicious.
What Garnet catches is the **ancestry pivot**: a Node.js process inside
an `npm install` tree handing execution to a different interpreter under
`~/.dev-env/`. That pivot is what makes Node-centric tooling go blind in
the real attack and what Garnet's eBPF sensor picks up regardless of
interpreter.

## Running the demo

- Baseline runs fire on pushes to `main` touching this directory or the
  workflow file. They establish the normal `pnpm install` shape for
  posthog-js.
- Deviation runs fire on PRs touching the same paths. When this directory
  is present in a PR, the `Shai-Hulud-class preinstall ancestry` step fires
  the chain above and Garnet's PR comment diffs the new process tree,
  new processes, and new egress against the baseline.
