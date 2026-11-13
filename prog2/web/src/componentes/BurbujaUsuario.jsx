import { useCallback, useState } from "react";
import { apiFetch } from "../lib/api.js";
import { useClickFuera } from "../lib/useClickFuera.js";
import { useSondeo } from "../lib/useSondeo.js";

const ESTILO_BURBUJA = {
  maxWidth: 140,
  padding: "4px 10px",
  borderRadius: 999,
  background: "var(--interruptor)",
  color: "var(--texto)",
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flexShrink: 0,
  border: 0,
};

function hace(seg) {
  if (seg < 60) return "ahora";
  return `hace ${Math.floor(seg / 60)} min`;
}

// Burbuja con el usuario activo. Para admin/admin_ext abre la lista de usuarios activos de la bodega.
export default function BurbujaUsuario({ usuario, puedeVerActivos }) {
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const caja = useClickFuera(() => setAbierto(false));

  const leer = useCallback(
    () =>
      apiFetch("/api/presencia", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error("fallo"))))
        .then((data) => {
          setLista(data.usuarios || []);
          setError("");
        })
        .catch((e) => {
          setError("No se pudo cargar.");
          throw e;
        }),
    []
  );
  useSondeo(leer, 20000, puedeVerActivos && abierto);

  if (!usuario) return null;

  if (!puedeVerActivos) {
    return (
      <span className="barra-usuario" title={`Usuario activo: ${usuario}`} style={ESTILO_BURBUJA}>
        {usuario}
      </span>
    );
  }

  return (
    <span ref={caja} style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      <button
        type="button"
        className="barra-usuario"
        aria-haspopup="true"
        aria-expanded={abierto}
        title="Ver usuarios activos en esta bodega"
        onClick={() => setAbierto((v) => !v)}
        style={{ ...ESTILO_BURBUJA, cursor: "pointer" }}
      >
        {usuario}
      </button>
      {abierto && (
        <div
          role="menu"
          aria-label="Usuarios activos"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            minWidth: 200,
            padding: 6,
            background: "var(--superficie)",
            border: "1px solid var(--borde)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
            zIndex: 20,
            fontSize: 13,
            color: "var(--texto)",
          }}
        >
          <div style={{ padding: "4px 8px", fontWeight: 700 }}>Activos en esta bodega</div>
          {error && <div style={{ padding: "4px 8px" }}>{error}</div>}
          {!error && lista === null && <div style={{ padding: "4px 8px" }}>Cargando…</div>}
          {!error && lista && lista.length === 0 && <div style={{ padding: "4px 8px" }}>Nadie activo.</div>}
          {lista &&
            lista.map((u) => (
              <div key={u.usuario} style={{ display: "flex", gap: 10, justifyContent: "space-between", padding: "4px 8px" }}>
                <span>
                  {u.usuario}
                  {u.usuario === usuario ? " (tú)" : ""}
                  <span style={{ opacity: 0.65 }}> · {u.rol}</span>
                </span>
                <span style={{ opacity: 0.65 }}>{hace(u.hace_seg)}</span>
              </div>
            ))}
        </div>
      )}
    </span>
  );
}
