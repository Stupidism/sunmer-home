/**
 * 审计日志：按 BACKEND_STRUCTURE §13 记录关键操作。
 * Vercel 部署时 stdout 会被采集，便于排查与合规。
 */
type AuditEvent =
  | { type: 'PLAN_GENERATE'; userId: number; weekStartDate: string }
  | { type: 'PLAN_SAVE_DRAFT'; userId: number; weekStartDate: string }
  | { type: 'PLAN_REPLACE_DISH'; userId: number; slotIndex: number }
  | { type: 'PLAN_CONFIRM'; userId: number; planId: number; weekStartDate: string }
  | { type: 'PLAN_COPY_FROM_HISTORY'; userId: number; sourcePlanId: number; targetWeekStart: string }
  | { type: 'TEMPLATE_UPDATE'; userId: number }
  | { type: 'DISH_PREFERENCE_UPDATE'; userId: number }
  | { type: 'PASSWORD_CHANGE'; userId: number }

export function audit(event: AuditEvent) {
  const entry = {
    ts: new Date().toISOString(),
    ...event,
  }
  console.log('[audit]', JSON.stringify(entry))
}
