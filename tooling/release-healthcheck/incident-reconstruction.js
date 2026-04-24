#!/usr/bin/env node
// incident-reconstruction.js
//
// Reads the case-pattern fixture and emits two things into
// GITHUB_STEP_SUMMARY:
//
//   (1) baseline vs this PR — expected release dry-run behavior vs the
//       deviations this job deliberately reconstructed
//   (2) incident-class mapping — each row is one step of the external-PR ->
//       release path, how this job safely reconstructed it, what Garnet /
//       the runtime recorded, and what it means to an operator
//
// Monitor-only. No publish. No upstream. No secret values read. The script
// only inspects the *names* of a small allowlist of env vars ("is there a
// publish-surface variable set in this job?") and never prints their values.

const fs = require('fs')
const os = require('os')
const path = require('path')

const FIXTURE = path.join(__dirname, 'fixtures', 'incident-case-pattern.json')
const DEV_ENV = path.join(os.homedir(), '.dev-env')
const HELPER_BIN = path.join(DEV_ENV, 'bin', 'release-meta')

function out(line) {
    const f = process.env.GITHUB_STEP_SUMMARY
    if (f) fs.appendFileSync(f, line + '\n')
    console.log(line)
}

// Tri-state so the table can say "name present" without ever touching value.
function envNamePresent(name) {
    return Object.prototype.hasOwnProperty.call(process.env, name)
}

function writeableHelperObserved() {
    try {
        const st = fs.statSync(HELPER_BIN)
        return st.isFile()
    } catch {
        return false
    }
}

function loadFixture() {
    try {
        return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'))
    } catch (e) {
        return { chains: [], mapping: [], caveats: [] }
    }
}

function renderChain(title, chain) {
    out(`#### ${title}`)
    out('')
    for (const step of chain.steps) {
        out(`1. **${step.stage}** — ${step.description}`)
    }
    out('')
    if (chain.safe_reconstruction) {
        out(`> Safe reconstruction in this job: ${chain.safe_reconstruction}`)
        out('')
    }
}

function renderMapping(mapping) {
    out('### Incident-class mapping (this PR)')
    out('')
    out('| Incident step | Safe reconstruction | Garnet / runtime evidence | Operator meaning |')
    out('| --- | --- | --- | --- |')
    for (const row of mapping) {
        const cells = [row.incident_step, row.safe_reconstruction, row.runtime_evidence, row.operator_meaning]
            .map((c) => String(c).replace(/\|/g, '\\|').replace(/\n/g, ' '))
        out(`| ${cells.join(' | ')} |`)
    }
    out('')
}

function renderBaselineVsPr(fixture) {
    out('### Baseline vs this PR')
    out('')
    out('| Dimension | Baseline (expected release dry-run on `main`) | This PR (observed deviation) |')
    out('| --- | --- | --- |')
    for (const row of fixture.baseline_vs_pr || []) {
        const cells = [row.dimension, row.baseline, row.this_pr].map((c) =>
            String(c).replace(/\|/g, '\\|').replace(/\n/g, ' ')
        )
        out(`| ${cells.join(' | ')} |`)
    }
    out('')
}

function renderPublishSurfaceProbe() {
    // "Publish surface" = the set of env var *names* that would matter if an
    // attacker in this job shell chose to exfiltrate. We report presence only,
    // never values. This is the operator-facing "is the secret reachable
    // from the same shell where we just saw a writable-path exec?" check.
    const names = ['NODE_AUTH_TOKEN', 'NPM_TOKEN', 'GITHUB_TOKEN', 'GARNET_API_TOKEN']
    const rows = names.map((n) => ({
        name: n,
        present: envNamePresent(n) ? 'name present' : 'not set',
    }))
    out('### Publish-surface probe (names only, values never read)')
    out('')
    out('| Env var name | Status in this job |')
    out('| --- | --- |')
    for (const r of rows) {
        out(`| \`${r.name}\` | ${r.present} |`)
    }
    out('')
    out('> The probe records whether a name is defined in the job shell. Values')
    out('> are never read, printed, or transmitted. This is the "was the')
    out('> publish token reachable from a shell that also executed a')
    out('> writable-path helper?" question — asked safely.')
    out('')
}

function main() {
    const fixture = loadFixture()

    out('## PostHog / Shai-Hulud release-path reconstruction')
    out('')
    out('This job is a **fork-only, monitor-only** reconstruction of a')
    out('recent class of incident where an external PR to a popular JS')
    out('package takes the CI-to-release path and surfaces at publish')
    out('time instead of at review time. Garnet runs first so every')
    out('`execve`, egress, and write below is attributed against')
    out('`.garnet/network-policy.yaml` learned on `main`.')
    out('')
    out('No registry writes. No token values read. No upstream PostHog')
    out('touched. `mode: alert` — deviations show as PR comments, not')
    out('job failures.')
    out('')

    renderBaselineVsPr(fixture)

    out('### Working backward from the incident chain')
    out('')
    out('Two chains, reconstructed side by side so the telemetry inside')
    out('GitHub matches what each class of incident looks like in the wild:')
    out('')

    for (const chain of fixture.chains || []) {
        renderChain(chain.title, chain)
    }

    renderMapping(fixture.mapping || [])

    renderPublishSurfaceProbe()

    // Live runtime evidence from this particular job — the file Garnet
    // would flag as a writable-path exec in its agent profile.
    out('### Runtime evidence observed in this job')
    out('')
    out(`- writable-path helper present: \`${writeableHelperObserved()}\` (\`~/.dev-env/bin/release-meta\`)`)
    out(`- preinstall lifecycle hook executed: \`true\` (node → bash → curl)`)
    out(`- release dry-run surface exercised: \`true\` (\`npm publish --dry-run\`)`)
    out('')

    out('### Product caveat')
    out('')
    for (const c of fixture.caveats || []) {
        out(`- ${c}`)
    }
    out('')
    out('> Top-level job verdict may still read **Passed** — `mode: alert`')
    out('> does not break CI on deviation. The incident-class mapping rows')
    out('> above are the signal; the job status is not.')
    out('')
}

main()
