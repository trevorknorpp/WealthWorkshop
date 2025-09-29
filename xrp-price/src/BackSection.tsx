// src/components/BackSection.tsx
import { useEffect } from "react";

type Hotkey = "Escape" | "Backspace" | string;

export default function BackSection(props: {
  /** Optional custom click handler. If omitted, uses window.history.back(). */
  onBack?: () => void;
  /** Optional label. Defaults to "← Back". */
  label?: string;
  /** Optional extra className to attach to the outer wrapper. */
  className?: string;
  /** Optional inline styles to merge with the default wrapper styles. */
  style?: React.CSSProperties;
  /** Press this key to go back (default: "Escape"). Pass null/undefined to disable. */
  hotkey?: Hotkey | null;
  /** Ask for confirmation before navigating back. */
  confirm?: boolean;
  /** Custom confirmation text. */
  confirmText?: string;
} = {}) {
  const {
    onBack,
    label = "← Back",
    className,
    style,
    hotkey = "Escape",
    confirm = false,
    confirmText = "Go back?",
  } = props;

  // Single, centralized back action.
  function goBack() {
    if (confirm && !window.confirm(confirmText)) return;

    if (typeof onBack === "function") {
      onBack();
      return;
    }

    // Default behavior: browser back if possible, else try home.
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // Fallback if no history entry (e.g., direct link)
      // Change "/" to whatever your app's home route is.
      window.location.assign("/");
    }
  }

  // Optional hotkey (Escape by default)
  useEffect(() => {
    if (!hotkey) return;
    const handler = (e: KeyboardEvent) => {
      // Normalize simple cases: match by key
      if (e.key === hotkey) {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", handler, { passive: false });
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotkey, confirm, confirmText, onBack]);

  return (
    <div
      className={className}
      style={{
        padding: 8,
        display: "flex",
        gap: 12,
        alignItems: "center",
        ...(style || {}),
      }}
    >
      <button
        onClick={goBack}
        aria-label="Go back"
        style={{
          padding: "8px 12px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "rgba(111, 91, 91, 0.4)",
          color: "#eee",
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    </div>
  );
}
