# Weekly Menu AI Project Log

## Entry Template
- Date:
- Type:
- Status:
- Files:
- What changed:
- Why:
- Verification:

## Entries

### 2026-03-23 - Entry 1
- Date: 2026-03-23
- Type: fix
- Status: active
- Files:
  - `src/features/history/HistoryList.tsx`
  - `src/app/api/weekly-plan/history/route.ts`
- What changed:
  - Increased default history page size from 2 to 6.
  - Made per-week delete action more visible by switching to an outlined destructive-style button.
- Why:
  - History page showed too few records per page and delete action was easy to miss in UI.
- Verification:
  - `pnpm build`

### 2026-03-23 - Entry 2
- Date: 2026-03-23
- Type: fix
- Status: active
- Files:
  - `src/features/history/HistoryList.tsx`
- What changed:
  - Added page fallback logic after fetching history: when current page exceeds new `totalPages`, route automatically moves to the last valid page.
- Why:
  - Prevents showing an empty out-of-range page after deleting the last item on the last page.
- Verification:
  - `pnpm build`
