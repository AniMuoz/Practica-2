const BASE = { width: "100%", padding: "10px 14px", borderRadius: 6, fontSize: 14, cursor: "pointer" };
const PRINCIPAL = { ...BASE, border: 0, background: "var(--acento)", color: "var(--sobre)" };
const SECUNDARIO = { ...BASE, border: "1px solid var(--borde)", background: "var(--superficie)" };

// Cuadro de confirmacion modal. `acciones` es una lista de { texto, alClick, principal }.
export default function DialogoConfirmacion({ titulo, texto, acciones, etiqueta }) {
  return (
    <div
      role={etiqueta ? "dialog" : undefined}
      aria-label={etiqueta}
      style={{ position: "fixed", inset: 0, background: "rgba(17, 24, 39, 0.55)", display: "grid", placeItems: "center", padding: 24, zIndex: 80 }}
    >
      <div style={{ background: "var(--superficie)", borderRadius: 8, padding: 20, maxWidth: 420 }}>
        <p style={{ margin: "0 0 8px", fontWeight: 700 }}>{titulo}</p>
        <p style={{ margin: "0 0 16px", fontSize: 14 }}>{texto}</p>
        <div style={{ display: "grid", gap: 8 }}>
          {acciones.map(({ texto: etiquetaBoton, alClick, principal }) => (
            <button key={etiquetaBoton} type="button" onClick={alClick} style={principal ? PRINCIPAL : SECUNDARIO}>
              {etiquetaBoton}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
