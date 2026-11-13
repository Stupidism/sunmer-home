import { redirect } from "next/navigation";
import { dashboardAccess } from "@/lib/access";
import { getSessionUser } from "@/server/auth";
import { runtimeConfiguration } from "@/server/config";
import {
  getDashboardPayload,
  getPurposeHistory,
  getRefundOverview,
} from "@/server/repository";
import LedgerClient, { type LedgerView } from "./LedgerClient";

export default async function LedgerPage({ view }: { view: LedgerView }) {
  const user = await getSessionUser();
  const access = dashboardAccess(user, runtimeConfiguration());
  if (!access.allowed) {
    if (access.status === 401) redirect("/login");
    return (
      <State title="账本未就绪">
        运行配置不完整；系统没有读取或序列化任何财务数据。
      </State>
    );
  }

  try {
    const [payload, refunds, purposeHistory] = await Promise.all([
      getDashboardPayload(),
      getRefundOverview(),
      getPurposeHistory(),
    ]);
    if (!payload.months.length) {
      return (
        <State title="尚未导入账本">
          数据库连接正常，但没有可展示的月份。请先完成月度导入与核对。
        </State>
      );
    }
    return (
      <LedgerClient
        view={view}
        payload={payload}
        refunds={refunds}
        purposeHistory={purposeHistory}
        role={user!.role}
        username={user!.username}
      />
    );
  } catch {
    return (
      <State title="账本暂不可用">
        读取账本失败；未知数据不会显示为 0。请检查数据库与迁移状态。
      </State>
    );
  }
}

function State({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="state-page">
      <section className="state-card">
        <p className="eyebrow">Family Ledger</p>
        <h1>{title}</h1>
        <p>{children}</p>
      </section>
    </main>
  );
}
