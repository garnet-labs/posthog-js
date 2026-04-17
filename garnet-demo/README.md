# Garnet Demo Harness

This directory and the companion workflow `.github/workflows/garnet-demo.yml`
exist **only** on `garnet-labs/posthog-js` — a fork of `PostHog/posthog-js`
used to demonstrate Garnet Runtime Visibility's baseline + deviation
detection inside PRs.

**Nothing in this directory is part of posthog-js.** It will never be merged
upstream. It exists to show, on a real-world JavaScript monorepo, how
Garnet captures a baseline runtime profile on `main` and then surfaces only
the *deviations* when a PR changes CI behavior.

## How the demo works

1. `garnet-demo.yml` runs on pushes to `main` (and on PRs touching this
   directory). On each run, Garnet captures the process tree, network
   destinations, file activity, and detection signals. The first few
   runs become the baseline.
2. A PR is opened inside `garnet-labs/posthog-js` that adds a step to
   `garnet-demo.yml` with behavior that mimics the structural shape of
   a supply-chain attack (e.g., the Shai-Hulud 2.0 `preinstall` worm
   that hit PostHog in November 2025): scan for credential-shaped files,
   exfiltrate metadata to an external endpoint, spawn a secondary
   interpreter.
3. The PR runs the workflow. Garnet diffs the runtime behavior against
   the baseline and posts a PR comment showing only the net-new
   activity — new domains, new processes, new file patterns, new
   detections. Nothing from the baseline is repeated.

## Safety

- Egress goes only to `httpbin.org` — a public HTTP testing service.
  No real C2 domain is contacted.
- No real credential is read. The `find` step globs for file *names*
  matching credential patterns but does not open them.
- No real `trufflehog` or similar harvesting binary is installed.
- The workflow is scoped to `garnet-labs/posthog-js` only and has no
  upstream effect.
