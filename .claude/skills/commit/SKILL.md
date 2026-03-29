# Commit Skill

Create a well-formed git commit following the project's conventional commit style.

## Steps

1. Run `git status` and `git diff --staged` to understand what's being committed
2. If nothing is staged, identify relevant changed files and stage them (never `git add -A`)
3. Never commit files that contain secrets (.env, credentials, API keys)
4. Write a commit message following conventional commits:
   - Format: `<type>(<scope>): <description>`
   - Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`
   - Scope: the app name (`bubu-log`, `nunu-island`, etc.) or omit for repo-wide
   - Description: imperative mood, lowercase, no period
   - Body: explain "why" if not obvious from the description
5. Create the commit (include Co-Authored-By trailer)
6. Run `git status` to verify success

## Rules

- NEVER amend existing commits unless explicitly asked
- NEVER use `--no-verify` to skip hooks
- If a pre-commit hook fails, fix the issue and create a NEW commit
- Keep commits atomic: one logical change per commit
