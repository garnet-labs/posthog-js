# Scenario: Shai-Hulud-class patient-zero (flagged)

This branch represents an external-PR contribution that introduces a `package.json` lifecycle script chain consistent with a Shai-Hulud-class patient-zero compromise:

- A new `postinstall` script in a transitive dependency
- A child interpreter chain (`sh -c node …` → `node` → `sh -c …`) under the `npm install` lineage
- A dropped payload written to `/tmp` and immediately executed
- Outbound egress to a non-registry destination from the `npm install` process tree

The Garnet card on this PR is **flagged** — assertions in the curated detection library fire on first occurrence, no per-repo baseline required, because the behaviors above are intrinsically anomalous in a CI install path.

The card shows what a reviewer needs to see before deciding to merge: the assertion that fired, the process lineage that triggered it, and the recommended action. The full forensic detail is one click away under the collapsed details — never in the way of the verdict.
