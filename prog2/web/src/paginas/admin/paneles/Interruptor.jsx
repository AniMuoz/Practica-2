export default function Interruptor({ activo, onClick, texto }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: 0,
        border: "none",
        background: "transparent",
        color: "inherit",
        cursor: "pointer",
        fontSize: 14,
      }}
    >
      <span
        style={{
          width: 40,
          height: 22,
          borderRadius: 999,
          background: activo ? "var(--boton)" : "var(--borde)",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: activo ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.15s ease",
          }}
        />
      </span>
      {texto}
    </button>
  );
}
