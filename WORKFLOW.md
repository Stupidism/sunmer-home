# Workflow: Claude Code + Linear

This file defines how Claude Code agents should process Linear tickets in this monorepo.

## Linear Board States

```
Todo → In Progress → Human Review → Merging → Done
                         ↓
                      Rework → In Progress
```

| State | Who acts | What happens |
|-------|----------|--------------|
| **Todo** | Agent picks up | Agent claims ticket, creates branch, starts work |
| **In Progress** | Agent working | Agent implements, tests, creates PR |
| **Human Review** | Human reviews | Agent pauses; if changes requested → Rework |
| **Rework** | Agent re-works | Agent addresses feedback, re-pushes |
| **Merging** | Agent merges | PR approved, squash-merge |
| **Done** | Terminal | PR merged, ticket closed |

## Agent Workflow (per ticket)

### 1. Claim & Plan

- Read the ticket description, understand scope
- Create a feature branch from main: `feat/<linear-id>-<short-slug>`
- Use git worktree if user is on a different branch
- Post a workpad comment on the Linear ticket:
  ```
  ## Claude Workpad
  - [ ] Step 1
  - [ ] Step 2
  ...
  ```
- Move ticket to **In Progress**

### 2. Implement

- Follow CLAUDE.md conventions strictly
- Keep changes narrowly scoped — no unrelated refactors
- Add `data-testid` attributes for e2e test selectors
- Check off workpad items as completed

### 3. Write E2E Tests

- Write Playwright tests covering main flows
- Enable video recording: `video: 'on'`
- Tests must use `data-testid` selectors

### 4. Create PR & Wait for Preview

- Commit with conventional commit message (include `Closes SUN-XX`)
- Push branch, create PR via `gh pr create`
- PR body must include:
  - `## Summary` — what changed and why
  - `## Linear ticket` — link to the issue
  - `## Test plan` — how changes were validated
- Wait for Vercel preview deployment to be ready

### 5. Run E2E Against Vercel Preview

This is a **mandatory** step. Tests must run against the preview, not localhost.

- Get the Vercel preview URL from PR comments
- Preview uses Neon database branching — safe to seed test data
- Create a `playwright.preview.config.ts` (no webServer, baseURL = preview URL, `video: 'on'`)
- Run tests: `npx playwright test tests/<file>.spec.ts --config=playwright.preview.config.ts --workers=1`
- Collect video recordings from `test-results/`

### 6. Post Evidence on Linear Ticket

Before requesting review, the ticket must have:

1. **Workpad comment** with:
   - Implementation plan checklist (all ✅)
   - Validation results (test pass count)
   - PR link
   - Changed files list

2. **Video evidence comment** with:
   - Each test's video uploaded to Linear (via `fileUpload` mutation)
   - Video links in a numbered list with test descriptions
   - Test environment info (preview URL, browser, duration)

### 7. Move to Human Review

Only after ALL of these are true:
- [ ] All e2e tests pass against Vercel preview
- [ ] Videos uploaded to Linear ticket
- [ ] Workpad comment posted with PR link and test results
- [ ] CI checks green on the PR
- Move ticket to **Human Review**

### 8. Review Cycle

- If reviewer requests changes → ticket moves to **Rework**
- Address ALL review comments
- Re-validate, re-run tests if code changed
- Push updates, move back to **Human Review**

### 9. Land

- Once approved, squash-merge the PR: `gh pr merge --squash`
- Move ticket to **Done**

## Ticket Format

```markdown
## Context
<Why this work is needed>

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2

## Acceptance Criteria
- [ ] AC 1: <specific, testable condition>
- [ ] AC 2: <specific, testable condition>

## Scope
App: <bubu-log | nunu-island | wedding-invite | weekly-menu>
Priority: <P0 | P1 | P2>
```

## Conventions

- **Branch naming**: `feat/SUN-XX-slug`, `fix/SUN-XX-slug`, `chore/SUN-XX-slug`
- **Commit style**: conventional commits, e.g. `feat(bubu-log): add batch import`
- **One ticket = one PR**: don't bundle unrelated work
- **Out-of-scope items**: file as new Linear tickets
- **Testing**: every feature ticket must have e2e tests with video proof
