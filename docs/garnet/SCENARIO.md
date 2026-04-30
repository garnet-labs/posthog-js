# Scenario: Third-party action overreach (review)

This branch represents a PR that adds a third-party scanning action (Trivy / KICS-class) to the workflow tree. The action itself runs in a normal `unit` job context. The Garnet card flags the run as **needs review** because the action's process tree exhibits primitives that legitimate scanners do not require:

- `credentials_files_access` from inside the action's process tree (not the repo's own build/test code)
- `interpreter_shell_spawn` from the action branch (action shelling out beyond its declared scope)
- A non-standard egress destination not pinned to the action's documented requirements

This is a **review** verdict, not a fail. The reviewer's decision: pin the action to a vetted SHA, remove floating tags, or remove the action entirely if its behavior cannot be justified.

Garnet's job here is not to block the PR. It is to surface the one thing in the diff that a human should look at, with the process lineage that makes the decision a one-minute call.
