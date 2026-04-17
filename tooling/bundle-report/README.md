# Bundle Report

Lightweight CI job that measures the gzipped size of the built `packages/browser`
entry points on every PR that touches the browser package or this tooling
directory. The workflow captures the numbers on `main` as a baseline and the
PR comment (posted by the runtime observability action) surfaces the delta.
