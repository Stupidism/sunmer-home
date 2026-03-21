## General Behavior

When asked to fix issues from PR reviews or bot comments, actually implement the code fixes — do not just summarize or describe the problems.

## Git Operations

For git push operations: always verify SSH host keys are trusted first (`ssh -T git@github.com`), and if SSH fails, fall back to HTTPS. Check git remote permissions before attempting push.

## Project Context

This is a TypeScript project using dayjs for date handling. When adding dependencies or making changes, apply them to the application source code, not CI/GitHub Actions config, unless explicitly asked.

## CSS / UI Changes

When implementing UI/layout changes, verify the change actually takes effect by checking that old constraints (e.g., max-width, fixed widths) are removed. Do not just add new CSS — also remove conflicting existing rules.

## CI/CD

When reporting results of CI/deployments, verify each individual result. Do not assume all succeeded if some failed. Report exact counts (e.g., '2/4 deployments succeeded').
