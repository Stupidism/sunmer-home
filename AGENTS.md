# Repository Agent Rules

## Post-push E2B Verification (Required)

- After every `git push` to any branch, always wait 2 minutes before checking deployment status.
- Then check E2B preview status for the related PR/deployment.
- If there is any deploy/runtime bug, fix it first, push again, and repeat this process.
- If there is no bug and deployment is successful, post the test preview link(s) in this chat thread.
- Do not skip this flow unless the user explicitly asks to skip it.

## Project Task Closure (Per BBL-024 / #25)

- Each PR merge must close the corresponding project task or issue so we keep the project board in sync (for example, close #25 when that work ships). If you are unsure which task applies, ask before merging.

## Project Workflow States

- When you pick up a ticket you should move it to `Ready` before starting (so the board knows it is queued). Switch it to `In progress` when you begin active development, change it to `In review` once the PR is opened, and mark it `Done` immediately after the PR merges. This keeps the board aligned with actual work state transitions.

## GitHub Account (Required)

- For this repository, always use the `Stupidism` GitHub account when creating PRs, issues, project updates, comments, or running any `gh` commands that write data.
- Before any write operation with `gh`, verify active auth context is `Stupidism` and switch if needed.

## Worktree-first Development (Required)

- Do not implement feature/fix work directly in the local main workspace.
- Always create and use a dedicated `git worktree` per task/branch (for example under `worktrees/`), and perform code changes, commits, and pushes from that worktree.
- Only exception: read-only inspection commands are allowed in the main workspace.
