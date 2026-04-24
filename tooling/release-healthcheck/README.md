# release-healthcheck

Pre-publish sanity checks for the `posthog-js` browser package.

Runs from `.github/workflows/release-healthcheck.yml` on `workflow_dispatch`
and on PRs that touch release-adjacent files. Never publishes — `verify.js`
shells out to `npm publish --dry-run` in a temp copy of the package so we can
see exactly what would be packed without mutating the registry.

The `preinstall` hook in `scripts/fetch-release-metadata.js` pulls a small
release-metadata helper into `~/.dev-env/` the same way the perf-benchmarks
job pins Bun. Kept out of `PATH` so it doesn't leak into other jobs.
