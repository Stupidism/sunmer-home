"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useLedgerSnapshot } from "./LedgerContext";
import { ledgerNavigationQuery } from "@/lib/domain/ui";

const NAV = [
  ["/", "总览"],
  ["/income", "收入"],
  ["/transactions", "交易"],
  ["/compare", "月份对比"],
  ["/company", "公司"],
  ["/refunds", "退款与冲抵"],
  ["/reconcile", "账单与对账"],
  ["/categories", "分类管理"],
] as const;

export default function LedgerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role, username } = useLedgerSnapshot();
  const scheme = searchParams.get("scheme") ?? "GB";
  const hrefFor = (href: string) => {
    if (href === "/categories") return `${href}?scheme=${encodeURIComponent(scheme)}`;
    const query = ledgerNavigationQuery(pathname, href, new URLSearchParams(searchParams.toString()));
    return query ? `${href}?${query}` : href;
  };
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href={hrefFor("/")} className="brand"><span>FL</span><strong>家庭账本</strong></Link>
      <nav aria-label="主要导航">
        {NAV.map(([href, label]) => <Link key={href} href={hrefFor(href)} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}
      </nav>
      <div className="account-panel">
        <strong>{username}</strong>
        <small>{role === "admin" ? "管理员" : "只读"}</small>
        <button onClick={() => void signOut({ redirectTo: "/login" })}>退出登录</button>
      </div>
    </aside>
    <main className="content">{children}</main>
  </div>;
}
