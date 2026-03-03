"use client";

import { useState } from "react";
import { useEffect } from "react";

function getGuestIDFromPathname(pathname: string): string | null {
  const match = pathname.match(/\/collections\/guests\/([^/?#]+)/);
  if (match?.[1]) {
    const id = decodeURIComponent(match[1]);
    return id === "create" ? null : id;
  }

  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.lastIndexOf("guests");
  if (idx >= 0 && idx + 1 < parts.length) {
    const id = decodeURIComponent(parts[idx + 1]);
    return id === "create" ? null : id;
  }

  return null;
}

export function PolishInvitationButton() {
  const guestID =
    typeof window !== "undefined" ? getGuestIDFromPathname(window.location.pathname) : null;
  const [loading, setLoading] = useState(false);
  const [loadingLink, setLoadingLink] = useState(false);
  const [shareLink, setShareLink] = useState<string>("");
  const [message, setMessage] = useState("");

  const loadLink = async () => {
    if (!guestID) {
      setShareLink("");
      return;
    }

    setLoadingLink(true);
    try {
      const response = await fetch(
        `/api/admin/guests/${encodeURIComponent(guestID)}/invitation-link`,
        { method: "GET" },
      );
      const payload = (await response.json()) as {
        success?: boolean;
        shareLink?: string | null;
      };
      if (response.ok && payload.success && payload.shareLink) {
        setShareLink(payload.shareLink);
      } else {
        setShareLink("");
      }
    } catch {
      setShareLink("");
    } finally {
      setLoadingLink(false);
    }
  };

  useEffect(() => {
    void loadLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestID]);

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
        shareLink?: string;
        error?: string;
      };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Polish failed");
      }

      if (payload.shareLink) {
        setShareLink(payload.shareLink);
      } else {
        await loadLink();
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
        disabled={!shareLink || loadingLink}
        style={{
          border: "1px solid var(--theme-elevation-300)",
          borderRadius: 8,
          padding: "8px 12px",
          background: "var(--theme-bg)",
          cursor: !shareLink || loadingLink ? "not-allowed" : "pointer",
          opacity: !shareLink || loadingLink ? 0.6 : 1,
        }}
      >
        打开邀请链接
      </button>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!shareLink || loadingLink}
        style={{
          border: "1px solid var(--theme-elevation-300)",
          borderRadius: 8,
          padding: "8px 12px",
          background: "var(--theme-bg)",
          cursor: !shareLink || loadingLink ? "not-allowed" : "pointer",
          opacity: !shareLink || loadingLink ? 0.6 : 1,
        }}
      >
        复制邀请链接
      </button>
      {!guestID ? <p style={{ margin: 0, fontSize: 12 }}>请先保存宾客，再生成邀请词。</p> : null}
      {guestID && !shareLink ? <p style={{ margin: 0, fontSize: 12 }}>先点击 Polish 生成，再打开链接。</p> : null}
      {shareLink ? (
        <p style={{ margin: 0, fontSize: 12, wordBreak: "break-all" }}>{shareLink}</p>
      ) : null}
      {message ? <p style={{ margin: 0, fontSize: 12 }}>{message}</p> : null}
    </div>
  );
}
