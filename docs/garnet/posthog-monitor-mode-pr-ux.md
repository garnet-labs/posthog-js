# Garnet Monitor Mode — Final PR UX (PostHog)

This document captures what Garnet's monitor-mode PR review comments look like
when posted on a real pull request. The cards below are the exact format and
tone Garnet would use when commenting on a PostHog PR — concise findings, a
risk classification, the runtime evidence that supports it, and the file/line
context the reviewer needs.

> **Note on incident cards.** Several of the cards below are labeled
> *replayed Garnet evidence* and reproduce findings Garnet captured in other
> real-world incidents (axios compromise, Bitwarden secret-surface review,
> third-party action overreach, Shai-Hulud-class pgserve). They are included
> here so PostHog reviewers can see how Garnet renders those classes of risk
> end-to-end. **None of these incident payloads execute in the PostHog
> repository.** They are evidence examples, not active code paths.

---

## 1. Clean run — typical PR with no findings

> **Garnet · Monitor mode** &nbsp;·&nbsp; ✅ No risk findings

**Summary**

- Workflow: `garnet-demo` (Node 20, pnpm 9)
- Build + unit tests completed in 2m41s
- 0 outbound network destinations outside the allowlist
- 0 filesystem writes outside `/tmp`, `node_modules`, and the workspace
- 0 process spawns outside the declared toolchain (`node`, `pnpm`, `tsc`, `jest`)

**What Garnet checked**

| Surface           | Result          |
|-------------------|-----------------|
| Dependency install| clean           |
| Build scripts     | clean           |
| Test runner       | clean           |
| Network egress    | within policy   |
| Secret access     | none observed   |

No action required. Garnet will continue to monitor subsequent pushes to this
branch.

---

## 2. Release dry-run — clean

> **Garnet · Monitor mode** &nbsp;·&nbsp; ✅ Release dry-run clean

**Context**

- Trigger: `workflow_dispatch` on `release.yml` with `dry_run: true`
- Tag candidate: `v1.234.0`
- Artifacts produced: `posthog-js-1.234.0.tgz`, source map bundle

**Findings**

- Publish step ran in `--dry-run` mode; no `npm publish` network call observed.
- `npm pack` output checksum matches the previous green main build's pack
  contents minus the version-string diff.
- No `postpack`/`prepublishOnly` hooks introduced new outbound endpoints.
- Token surface: `NODE_AUTH_TOKEN` was scoped to the publish job and was not
  read by any other step.

Safe to promote to a real release run.

---

## 3. Compromised dependency install — `axios` — review needed

> **Garnet · Monitor mode** &nbsp;·&nbsp; ⚠️ Review needed — install-time
> behavior on `axios@<malicious-version>`

> *Replayed Garnet evidence.* This card reproduces the install-time behavior
> Garnet observed during the public `axios` supply-chain incident. It is
> shown here so PostHog reviewers can see what the comment looks like when a
> compromised transitive dependency is introduced. **The payload does not
> execute in this repository.**

**File**

- `package.json` (direct or transitive bump to a malicious `axios` version)

**What Garnet observed at install time**

- `node` process spawned during `pnpm install` from inside the `axios`
  package's `postinstall` hook.
- The spawned process attempted to read:
  - `~/.npmrc`
  - `~/.gitconfig`
  - `~/.aws/credentials`
  - environment variables matching `/TOKEN|SECRET|KEY/`.
- Outbound HTTPS connection attempted to a domain that is **not** in the
  declared dependency or registry allowlist.
- The hook attempted to base64-encode the collected material before transmit.

**Why this is review-needed and not auto-blocked**

PostHog's monitor-mode policy is to surface and stop the supply-chain class
without taking destructive action on the developer's branch. Garnet captured
the runtime evidence and is asking a human to:

1. Pin `axios` back to the last-known-good version, **or**
2. Confirm this version was intentionally introduced (it almost certainly
   was not).

**Sources**

- Garnet write-up of the axios install-time exfiltration pattern:
  <https://garnet.ai/blog>
- StepSecurity advisory on the axios incident:
  <https://www.stepsecurity.io/blog>

---

## 4. Procfs / credential-surface read — Bitwarden-style — review needed

> **Garnet · Monitor mode** &nbsp;·&nbsp; ⚠️ Review needed — credential
> surface enumeration during build

> *Replayed Garnet evidence.* This card reproduces a finding Garnet has
> captured in a Bitwarden-class incident, where a build step walked
> `/proc/<pid>/environ` to harvest secrets from sibling processes. It is
> included so PostHog reviewers can see the exact comment shape for that
> class. **The behavior does not execute in this repository.**

**What Garnet observed**

- A build-time script opened `/proc/self/environ` and then iterated peer
  PIDs under `/proc/*/environ`.
- The same script `read(2)`'d `~/.config/Bitwarden CLI/data.json` and
  `$HOME/.ssh/id_*`.
- No corresponding declaration in the repository's `package.json` or
  workflow file justified reading those paths.

**Risk class**

Credential-surface enumeration. Even without exfiltration in the same step,
this is the staging behavior Garnet flags as review-needed because the
collected material is typically transmitted in a later job or a follow-up
push.

**Suggested reviewer actions**

- Identify which dependency or script introduced the `/proc` walk.
- If intentional (e.g., a legitimate diagnostics tool), add an explicit
  allowlist entry; otherwise, revert the change.

**Sources**

- Garnet's coverage of credential-surface enumeration patterns:
  <https://garnet.ai/blog>

---

## 5. Third-party action overreach — Trivy / KICS — review needed

> **Garnet · Monitor mode** &nbsp;·&nbsp; ⚠️ Review needed — third-party
> action requested capabilities beyond its declared scope

> *Replayed Garnet evidence.* This card reproduces a class of finding
> Garnet has captured against widely used scanning actions (Trivy, KICS)
> when pinned to a tag rather than a commit SHA and when granted
> repository-wide token scope. **The behavior does not execute in this
> repository.**

**What Garnet observed**

- `aquasecurity/trivy-action@<floating-tag>` ran with
  `permissions: write-all` inherited from the workflow default.
- The action's container made outbound calls to a host that is not the
  Trivy DB mirror declared in its documentation.
- The action read the workflow's `GITHUB_TOKEN` and used it to enumerate
  branch protection rules — which is outside the scope of a vulnerability
  scanner.

**Why review-needed**

Third-party actions are a high-leverage supply-chain surface. Garnet's
policy is to flag, not block, so the maintainer can:

1. Pin the action to a commit SHA.
2. Reduce `permissions:` to the minimum the scanner actually needs
   (typically `contents: read`, `security-events: write`).
3. Confirm whether the observed egress is expected.

The same pattern applies to `Checkmarx/kics-github-action` and other
scanning actions that ship as containers.

---

## 6. Shai-Hulud-class self-propagating worm — `pgserve` — review needed

> **Garnet · Monitor mode** &nbsp;·&nbsp; ⚠️ Review needed —
> self-propagating worm pattern observed during install

> *Replayed Garnet evidence.* This card reproduces the runtime shape
> Garnet captured for the Shai-Hulud-class worm seen in npm packages
> including `pgserve`. It is shown here so PostHog reviewers can see how
> Garnet renders a self-propagating supply-chain incident. **The payload
> does not execute in this repository.**

**What Garnet observed at install time**

- `node` was spawned from the package's lifecycle script and immediately
  performed three distinct behaviors associated with the Shai-Hulud
  family:
  1. **Credential harvest.** Read `~/.npmrc`, `~/.yarnrc`,
     `~/.aws/credentials`, GitHub CLI tokens under `~/.config/gh/`, and
     environment variables matching `/NPM_TOKEN|GH_TOKEN|AWS_/`.
  2. **Repository write-back.** Attempted to authenticate to the npm
     registry using harvested tokens and to publish a tampered version
     of unrelated packages owned by the compromised maintainer
     (the propagation step).
  3. **CI footprint.** Wrote a workflow file under `.github/workflows/`
     in any local clone discoverable from `$HOME`, designed to re-trigger
     the harvest on the next push.
- Outbound HTTPS to a non-allowlisted domain occurred during step 1.

**Why this is the highest-severity card**

Unlike a single-package compromise, Shai-Hulud-class worms turn each
infected developer machine and CI runner into a publisher of further
compromised packages. Garnet flags this pattern as the top class to
escalate immediately, even in monitor mode, because the cost of a
delayed human response is propagation rather than just exposure.

**Suggested reviewer actions**

- Do **not** run `pnpm install` / `npm install` locally on this branch
  until the offending package is removed.
- Rotate any tokens that were present in the environment of any runner
  that already executed the install.
- Pin the affected dependency back to its last-known-good version and
  confirm the lockfile diff.

**Sources**

- Garnet's "five attacks" overview, which catalogs the Shai-Hulud
  class alongside the axios, Bitwarden, and third-party-action
  patterns shown above: <https://garnet.ai/blog>

---

## How to read these cards

Each card is what a reviewer would actually see as a single PR comment
from Garnet. The shape is intentionally consistent:

1. **Headline** — risk class and a one-line verdict.
2. **What Garnet observed** — the runtime evidence (process, file,
   network) that produced the verdict.
3. **Why this classification** — why monitor mode chose
   *clean* / *review-needed* rather than block.
4. **Suggested reviewer actions** — concrete next steps for the human
   on the PR.
5. **Sources** — public links when the card replays a known incident
   pattern, so reviewers can corroborate the behavior independently.

Monitor mode never takes destructive action on a PostHog branch. It
surfaces evidence and waits for a human decision.
