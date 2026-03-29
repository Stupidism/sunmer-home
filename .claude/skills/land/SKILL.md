# Land Skill

Monitor a PR until it's ready to merge, then squash-merge it.

## Steps

1. Get the current PR number: `gh pr view --json number,state,reviews,statusCheckRollup`
2. Check PR status:
   - All CI checks must be green
   - At least one approving review (or user explicitly says to merge)
   - No merge conflicts
3. If there are merge conflicts:
   - Pull latest main: `git fetch origin main && git merge origin/main`
   - Resolve conflicts if straightforward
   - Push the resolution
   - Wait for CI to re-run
4. If CI is failing:
   - Investigate the failure
   - Fix if possible, otherwise report to user
5. Once all checks pass and PR is approved:
   - Squash merge: `gh pr merge --squash --auto`
   - Verify merge completed: `gh pr view --json state`
6. Report the final status with the merge commit SHA

## Rules

- NEVER force-merge or bypass required checks
- NEVER merge without approval unless user explicitly says so
- If stuck, report status and ask user for guidance
