export default function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,.2)",
        background: "transparent",
        color: "#eee",
        cursor: "pointer",
        marginBottom: 8,
      }}
    >
      ← Back
    </button>
  );
}
