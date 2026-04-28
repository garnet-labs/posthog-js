# release-healthcheck

Pre-publish sanity check for `packages/browser` (`posthog-js`). Runs from
`.github/workflows/release-healthcheck.yml` on `workflow_dispatch` and on
PRs that touch release-adjacent files.

## What it does

`verify.js` copies `packages/browser/package.json` into a tempdir, strips
lifecycle scripts, and runs `npm publish --dry-run --json`. The packed
file list and advertised version are appended to `$GITHUB_STEP_SUMMARY`
so a reviewer can see them inline on the PR page. No auth is read, no
tarball is uploaded.

Garnet runs as the first step of the workflow in monitor mode so the
runtime behavior of the dry-run job (execve / egress / writes) is
recorded against `.garnet/network-policy.yaml`.

## Safety envelope

- **No publish.** `npm publish` is only ever invoked with `--dry-run`
  inside a tempdir copy.
- **No token read.** The workflow does not reference `NODE_AUTH_TOKEN` or
  any other publish credential.
- **Garnet in monitor mode.** Deviations surface as PR comments; the job
  does not fail on them.

## Files

- `package.json` — local `@posthog-js/release-healthcheck` package.
- `verify.js` — publish-surface dry-run.
