"use client";

import { useEffect, useState } from "react";

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
  const [loading, setLoading] = useState(false);
  const [loadingLink, setLoadingLink] = useState(false);
  const [shareLink, setShareLink] = useState("");
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

  useEffect(() => {
    void loadLink();
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

      // Refresh the page so Payload reloads the updated invitationCopy field
      window.location.reload();
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
      {guestID && !shareLink ? (
        <p style={{ margin: 0, fontSize: 12 }}>正在准备邀请链接，通常保存后即可直接打开或复制。</p>
      ) : null}
      {shareLink ? (
        <p style={{ margin: 0, fontSize: 12, wordBreak: "break-all" }}>{shareLink}</p>
      ) : null}
      {message ? <p style={{ margin: 0, fontSize: 12 }}>{message}</p> : null}
    </div>
  );
}
