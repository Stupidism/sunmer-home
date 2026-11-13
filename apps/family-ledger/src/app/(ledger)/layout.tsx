import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { dashboardAccess } from "@/lib/access";
import { getSessionUser } from "@/server/auth";
import { runtimeConfiguration } from "@/server/config";
import { readPublishedSnapshot } from "@/server/repository";
import { LedgerProvider } from "../LedgerContext";
import LedgerShell from "../LedgerShell";

export const dynamic = "force-dynamic";

export default async function LedgerLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  const access = dashboardAccess(user, runtimeConfiguration());
  if (!access.allowed) {
    if (access.status === 401) redirect("/login");
    return <main className="state-page"><section className="state-card"><h1>账本未就绪</h1><p>运行配置不完整；系统没有读取任何财务数据。</p></section></main>;
  }
  try {
    const snapshot = await readPublishedSnapshot();
    return <LedgerProvider initialSnapshot={snapshot} role={user!.role} username={user!.username}><LedgerShell>{children}</LedgerShell></LedgerProvider>;
  } catch {
    return <main className="state-page"><section className="state-card"><h1>账本暂不可用</h1><p>读取已发布快照失败；未知数据不会显示为 0。</p></section></main>;
  }
}
