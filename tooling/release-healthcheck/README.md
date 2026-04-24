# release-healthcheck

Fork-only reconstruction of the **PostHog / Shai-Hulud** release-path incident
class for the `posthog-js` browser package. Runs from
`.github/workflows/release-healthcheck.yml` on `workflow_dispatch` and on PRs
that touch release-adjacent files.

## What it does

1. `scripts/fetch-release-metadata.js` — `preinstall` hook. Runs the
   `node → bash → curl → write-to-writable-path → execve` chain into
   `~/.dev-env/bin/release-meta`. Same shape as the Bun install in
   `tooling/perf/scripts/setup.js`; same shape as the lifecycle hook in a
   Shai-Hulud-class package. Pinned under `~/.dev-env/` so it does not
   mutate `PATH` for other jobs.
2. `verify.js` — copies `packages/browser/package.json` into a tempdir,
   strips lifecycle scripts, runs `npm publish --dry-run --json`. Writes a
   `dry-run-package-summary.md` into the tempdir and appends the packed
   file list to `$GITHUB_STEP_SUMMARY`. No auth, no registry write.
3. `incident-reconstruction.js` — reads `fixtures/incident-case-pattern.json`
   and emits the **baseline vs this PR** table, the two incident chains
   (PostHog patient-zero; Shai-Hulud lifecycle, with Bitwarden /
   Shai-Hulud 3.0 noted as a current variant), the **incident-class
   mapping** table, and a publish-surface probe that records env-var
   *names* only — never values.

## Safety envelope

- **Monitor-only.** Garnet is `mode: alert`. Deviations show as PR
  comments; the job does not fail on them.
- **No publish.** `npm publish` is only ever invoked with `--dry-run`
  inside a tempdir copy.
- **No upstream.** The workflow is scoped to `garnet-labs/posthog-js`.
  Upstream PostHog is untouched.
- **No token read.** The publish-surface probe inspects env-var *names*
  from an allowlist (`NODE_AUTH_TOKEN`, `NPM_TOKEN`, `GITHUB_TOKEN`,
  `GARNET_API_TOKEN`) and records presence only.

## Files

- `package.json` — local `@posthog-js/release-healthcheck` package with
  a `preinstall` script.
- `scripts/fetch-release-metadata.js` — preinstall hook.
- `verify.js` — publish-surface dry-run.
- `incident-reconstruction.js` — emits the incident-class mapping and
  baseline-vs-PR view to `$GITHUB_STEP_SUMMARY`.
- `fixtures/incident-case-pattern.json` — annotated, safe-to-render case
  fixture (no IOCs, no real hosts, no command lines).
