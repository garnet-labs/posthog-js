# Scenario: Clean monitor-mode PR

This branch is the **silence baseline** for the Garnet PR-card UX.

A PR that does not change runtime behavior produces a single quiet card. No procfs reads. No credential-file walks. No outbound to anything outside the registry / GitHub Actions / Vercel telemetry surface.

The Garnet comment on this PR is what every PostHog reviewer should see on every PR that doesn't introduce something runtime-suspicious. Look at it almost never. Click in only if you want to.

The card's verdict is the only thing that needs to be read.
