# Linear Ticket Skill

Work on a Linear ticket end-to-end following the WORKFLOW.md process.

## Input

User provides a Linear ticket with: identifier (e.g. SUN-42), title, description, acceptance criteria.

## Steps

### Phase 1: Claim & Plan
1. Read the ticket description carefully
2. Create a feature branch from main: `feat/<linear-id>-<short-slug>`
   - Use git worktree for isolation if user is on a different branch
3. Draft a workpad plan (checklist of implementation steps)
4. Present the plan to the user for confirmation before proceeding

### Phase 2: Implement
1. Explore the relevant codebase to understand existing patterns
2. Implement changes following CLAUDE.md conventions
3. Keep changes narrowly scoped — never expand beyond ticket scope
4. If you discover out-of-scope improvements, note them for separate tickets

### Phase 3: Validate
1. Run type check: `npx tsc --noEmit` (in the relevant app directory)
2. Run lint if available: `pnpm lint`
3. Run tests if available (unit or e2e)
4. Verify each acceptance criterion from the ticket is met
5. If any validation fails, fix and re-validate

### Phase 4: Ship
1. Use `/commit` to create well-formed commits
2. Use `/pr` to create a pull request
3. PR must reference the Linear ticket
4. Report the PR URL to the user

### Phase 5: E2E on Preview
1. Wait for Vercel preview to deploy
2. Run e2e tests against preview URL with video recording
3. Upload videos to Linear ticket
4. Post workpad comment with all evidence

### Phase 6: Review Feedback
If the user reports review feedback:
1. Read all review comments
2. Address each comment (implement fix or explain why not)
3. Re-validate
4. Push updates
5. Report back

## Rules

- Follow WORKFLOW.md strictly
- One ticket = one PR
- Never skip validation or video evidence
- If blocked, ask the user rather than guessing
