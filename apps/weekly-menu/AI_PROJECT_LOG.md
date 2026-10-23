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

### 2026-10-23 - Node.js 安全运行时
- Date: 2026-10-23
- Type: chore
- Status: review
- Files:
  - `package.json`
- What changed:
  - 将 Node.js engines 限定为已修复的 22.x（^22.23.4），与仓库 CI 和 .nvmrc 保持一致。
- Why:
  - 响应 2026 年 10 月 Node.js 安全公告；原 CI Node 20 已停止支持。
- Verification:
  - Node v22.23.4 ARM64：冻结锁文件检查、配置检查及 weekly-menu TypeScript 检查通过。
  - 未部署；Vercel 实际补丁版本仍需上线前核验。
