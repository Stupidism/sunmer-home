"use client";
import { useLedgerSnapshot } from "./LedgerContext";
import LedgerClient, { type LedgerView } from "./LedgerClient";

export default function LedgerPage({ view }: { view: LedgerView }) {
  const { snapshot, role, username } = useLedgerSnapshot();
  return <LedgerClient view={view} payload={snapshot.payload} refunds={snapshot.refunds} purposeHistory={snapshot.purposeHistory} role={role} username={username} />;
}
