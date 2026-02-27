# E2B Template Build

Build a larger E2B template for PR preview workloads.

## Prerequisites

- E2B API key available in shell: `export E2B_API_KEY=...`
- Logged in to GitHub CLI as `Stupidism` for repo variable updates

## Build

```bash
cd /Users/sun/Documents/personal/sunmer-home
pnpm dlx --package e2b@2.13.0 --package tsx tsx scripts/e2b-template/build.prod.ts
```

Optional overrides:

```bash
E2B_TEMPLATE_NAME=bubu-preview-large \
E2B_TEMPLATE_CPU=4 \
E2B_TEMPLATE_MEMORY_MB=4096 \
pnpm dlx --package e2b@2.13.0 --package tsx tsx scripts/e2b-template/build.prod.ts
```

## Apply to this repository

```bash
gh variable set E2B_TEMPLATE \
  --repo Stupidism/sunmer-home \
  --body bubu-preview-large
```

Then re-run the `E2B PR Preview` workflow on a PR to verify preview URL generation.
