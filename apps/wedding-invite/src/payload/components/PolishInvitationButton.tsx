"use client";

import { useEffect, useState } from "react";
import { useField } from "@payloadcms/ui";

function normalizeGuestID(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const value = decodeURIComponent(raw).trim();
  if (!value || value === "create") {
    return null;
  }

  return value;
}

function getGuestIDFromPathname(pathname: string): string | null {
  const pathMatch = pathname.match(/\/collections\/guests\/([^/?#]+)/);
  if (pathMatch?.[1]) {
    return normalizeGuestID(pathMatch[1]);
  }

  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.lastIndexOf("guests");
  if (idx >= 0 && idx + 1 < parts.length) {
    return normalizeGuestID(parts[idx + 1]);
  }

  return null;
}

function getGuestIDFromDOM(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const idInput = document.querySelector<HTMLInputElement>('input[name="id"]');
  return normalizeGuestID(idInput?.value);
}

function resolveGuestID(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const fromPath = getGuestIDFromPathname(window.location.pathname);
  if (fromPath) {
    return fromPath;
  }

  const fromQuery = normalizeGuestID(new URLSearchParams(window.location.search).get("id"));
  if (fromQuery) {
    return fromQuery;
  }

  return getGuestIDFromDOM();
}

export function PolishInvitationButton() {
  const [guestID, setGuestID] = useState<string | null>(null);
  const invitationCopyField = useField<string>({ path: "invitationCopy" });
  const inviteCodeField = useField<string>({ path: "inviteCode" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const inviteCode = inviteCodeField.value;
  const shareLink =
    typeof inviteCode === "string" && inviteCode.trim()
      ? `${window.location.origin}/invite/${encodeURIComponent(inviteCode.trim())}`
      : "";

  useEffect(() => {
    const updateGuestID = () => {
      setGuestID(resolveGuestID());
    };

    updateGuestID();

    window.addEventListener("popstate", updateGuestID);
    const timer = window.setInterval(updateGuestID, 500);

    return () => {
      window.removeEventListener("popstate", updateGuestID);
      window.clearInterval(timer);
    };
  }, []);

  const handlePolish = async () => {
    if (!guestID) {
      setMessage("请先保存宾客，再生成邀请词。");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/guests/${encodeURIComponent(guestID)}/generate-invitation`,
        { method: "POST" },
      );

      const payload = (await response.json()) as {
        success?: boolean;
        aiUsed?: boolean;
        invitationCopy?: string;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Polish failed");
      }

      if (payload.invitationCopy) {
        invitationCopyField.setValue(payload.invitationCopy);
      }

      setMessage(payload.aiUsed ? "邀请词已 AI 润色并保存" : "邀请词已生成并保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Polish failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    if (!shareLink) {
      return;
    }

    window.open(shareLink, "_blank", "noopener,noreferrer");
  };

  const handleCopy = async () => {
    if (!shareLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink);
      setMessage("邀请链接已复制");
    } catch {
      setMessage("复制失败，请手动复制下方链接");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
      <button
        type="button"
        onClick={handlePolish}
        disabled={loading || !guestID}
        style={{
          border: "1px solid var(--theme-elevation-300)",
          borderRadius: 8,
          padding: "8px 12px",
          background: "var(--theme-bg)",
          cursor: loading || !guestID ? "not-allowed" : "pointer",
          opacity: loading || !guestID ? 0.6 : 1,
        }}
      >
        {loading ? "Polishing..." : "Polish 邀请词"}
      </button>
      <button
        type="button"
        onClick={handleOpen}
        disabled={!shareLink}
        style={{
          border: "1px solid var(--theme-elevation-300)",
          borderRadius: 8,
          padding: "8px 12px",
          background: "var(--theme-bg)",
          cursor: !shareLink ? "not-allowed" : "pointer",
          opacity: !shareLink ? 0.6 : 1,
        }}
      >
        打开邀请链接
      </button>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!shareLink}
        style={{
          border: "1px solid var(--theme-elevation-300)",
          borderRadius: 8,
          padding: "8px 12px",
          background: "var(--theme-bg)",
          cursor: !shareLink ? "not-allowed" : "pointer",
          opacity: !shareLink ? 0.6 : 1,
        }}
      >
        复制邀请链接
      </button>
      {!guestID ? <p style={{ margin: 0, fontSize: 12 }}>请先保存宾客，再生成邀请词。</p> : null}
      {guestID && !shareLink ? (
        <p style={{ margin: 0, fontSize: 12 }}>保存宾客后，邀请码会自动生成邀请链接。</p>
      ) : null}
      {shareLink ? (
        <p style={{ margin: 0, fontSize: 12, wordBreak: "break-all" }}>{shareLink}</p>
      ) : null}
      {message ? <p style={{ margin: 0, fontSize: 12 }}>{message}</p> : null}
    </div>
  );
}
