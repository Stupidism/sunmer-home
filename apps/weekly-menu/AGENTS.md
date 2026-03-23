# Weekly Menu Agent Rules

Scope: this AGENTS file applies only to `apps/weekly-menu`.

## Post-push Vercel Verification (Required)

- After every `git push` for `apps/weekly-menu`, wait 2 minutes before checking deployment status.
- Then check the related Vercel deployment/PR build.
- If there is any deploy/runtime issue, fix it first, push again, and repeat.
- If deployment is successful, post preview link(s) in chat.
- Do not skip unless the user explicitly asks to skip.

## Workflow and Task Closure

- Keep board states aligned with real work: `Ready` -> `In progress` -> `In review` -> `Done`.
- When a PR merges, close the corresponding issue/task.

## Weekly Menu AI Change Log (Required)

- For any code/functionality change under `apps/weekly-menu`, read `apps/weekly-menu/AI_PROJECT_LOG.md` first.
- After each such change, append exactly one new log entry using that file's template.
- Never overwrite or remove historical entries.
