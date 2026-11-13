"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PublishedDashboardSnapshot } from "@/lib/domain/types";

type SnapshotContextValue = {
  snapshot: PublishedDashboardSnapshot;
  role: "admin" | "viewer";
  username: string;
  refresh: () => Promise<void>;
  refreshing: boolean;
  refreshError: string;
};

const SnapshotContext = createContext<SnapshotContextValue | null>(null);

export function LedgerProvider({ initialSnapshot, role, username, children }: { initialSnapshot: PublishedDashboardSnapshot; role: "admin" | "viewer"; username: string; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [authorized, setAuthorized] = useState(true);
  const latestRef = useRef(snapshot);
  const inFlightRef = useRef<Promise<void> | null>(null);
  latestRef.current = snapshot;

  useEffect(() => {
    if (new Date(initialSnapshot.publishedAt).getTime() > new Date(latestRef.current.publishedAt).getTime()) {
      latestRef.current = initialSnapshot;
      setSnapshot(initialSnapshot);
      setRefreshError("");
    }
  }, [initialSnapshot]);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;
    const request = (async () => {
      setRefreshing(true);
      setRefreshError("");
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store", credentials: "same-origin" });
        if (response.status === 401) {
          setAuthorized(false);
          setRefreshError("登录状态已失效，正在返回登录页。");
          window.location.replace("/login");
          return;
        }
        if (!response.ok) {
          setRefreshError(`刷新失败（HTTP ${response.status}），请稍后重试。`);
          return;
        }
        let next: PublishedDashboardSnapshot;
        try {
          next = await response.json() as PublishedDashboardSnapshot;
        } catch {
          setRefreshError("刷新失败：服务器返回了无法读取的快照。");
          return;
        }
        const nextPublishedAt = new Date(next?.publishedAt).getTime();
        if (!next?.publishedAt || !Number.isFinite(nextPublishedAt) || !next.payload || !next.taxonomy) {
          setRefreshError("刷新失败：服务器返回的快照不完整。");
          return;
        }
        if (nextPublishedAt >= new Date(latestRef.current.publishedAt).getTime()) {
          latestRef.current = next;
          setSnapshot(next);
        }
      } catch {
        setRefreshError("刷新失败：无法连接服务器，请稍后重试。");
      } finally {
        setRefreshing(false);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = request;
    return request;
  }, []);
  const value = useMemo(() => ({ snapshot, role, username, refresh, refreshing, refreshError }), [snapshot, role, username, refresh, refreshing, refreshError]);
  if (!authorized) return <main className="category-page"><p role="alert" className="notice">登录状态已失效，正在返回登录页。</p></main>;
  return <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>;
}

export function useLedgerSnapshot() {
  const value = useContext(SnapshotContext);
  if (!value) throw new Error("LedgerProvider is missing");
  return value;
}
