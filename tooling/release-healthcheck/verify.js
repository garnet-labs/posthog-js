#!/usr/bin/env node
// Runs `npm publish --dry-run` on a temp copy of packages/browser so we can
// see exactly what would be packed without touching the registry.
//
// Fork-only. No auth, no writes to registry.npmjs.org. The output goes to
// GITHUB_STEP_SUMMARY so reviewers can see the packed file list and the
// advertised version in the GitHub PR page directly.

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const BROWSER_PKG = path.join(REPO_ROOT, 'packages', 'browser')
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'release-healthcheck-'))

function summary(line) {
    const f = process.env.GITHUB_STEP_SUMMARY
    if (f) fs.appendFileSync(f, line + '\n')
    console.log(line)
}

function copyPackageJson() {
    const src = path.join(BROWSER_PKG, 'package.json')
    const dst = path.join(WORK, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(src, 'utf8'))
    // Strip lifecycle hooks that would try to build the package; we only
    // want the pack manifest.
    delete pkg.scripts
    fs.writeFileSync(dst, JSON.stringify(pkg, null, 2))
    return pkg
}

function main() {
    summary('## Release dry-run surface')
    summary('')
    summary('**Scope:** `packages/browser` (`posthog-js`) — fork-only reconstruction.')
    summary('The publish surface is exercised here; the incident-class mapping that')
    summary('frames it follows in the next step.')
    summary('')

    const pkg = copyPackageJson()
    summary(`- declared version: \`${pkg.version}\``)
    summary(`- declared name: \`${pkg.name}\``)
    summary('')

    // `npm publish --dry-run` in a minimal dir — prints the file list that
    // would have been uploaded. Registry writes are suppressed by --dry-run.
    const result = spawnSync(
        'npm',
        ['publish', '--dry-run', '--json', '--registry=https://registry.npmjs.org'],
        { cwd: WORK, encoding: 'utf8' }
    )

    summary('### `npm publish --dry-run` output')
    summary('')
    summary('```')
    summary((result.stdout || '').trim() || '(no stdout)')
    summary('```')
    if (result.stderr && result.stderr.trim()) {
        summary('')
        summary('<details><summary>stderr</summary>')
        summary('')
        summary('```')
        summary(result.stderr.trim())
        summary('```')
        summary('')
        summary('</details>')
    }

    summary('')
    summary('> Dry-run. No tarball was uploaded. No auth token was read.')

    // Also write a small `dry-run-package-summary.md` in the tempdir so the
    // downstream reconstruction step has a concrete artifact path to point
    // at — the "what would have shipped" blast-radius manifest.
    try {
        const out = path.join(WORK, 'dry-run-package-summary.md')
        fs.writeFileSync(
            out,
            '# Dry-run package summary\n\n' +
                `- package: \`${pkg.name}\`\n` +
                `- version: \`${pkg.version}\`\n` +
                '- publish: suppressed (`--dry-run`)\n' +
                '- auth: not read\n\n' +
                '```\n' +
                ((result.stdout || '').trim() || '(no stdout)') +
                '\n```\n'
        )
        console.log(`[release-healthcheck] dry-run summary written: ${out}`)
    } catch (e) {
        // best-effort artifact; do not fail the job on IO errors
        console.error(`[release-healthcheck] could not write dry-run summary: ${e.message}`)
    }
}

main()
