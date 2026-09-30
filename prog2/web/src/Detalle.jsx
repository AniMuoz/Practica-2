import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

export default function Detalle() {
  const { codigo } = useParams();
  const [columnas, setColumnas] = useState([]);
  const [fila, setFila] = useState(null);
  const [inventario, setInventario] = useState("");
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setCargando(true);
    setError("");
    fetch(`/api/material/${encodeURIComponent(codigo)}`)
      .then((res) => {
        if (res.status === 404) throw new Error("Material no encontrado.");
        if (!res.ok) throw new Error("No se pudo leer la API");
        return res.json();
      })
      .then((data) => {
        setColumnas(data.columnas || []);
        setFila(data.fila);
        setInventario(data.fila.Inventario == null ? "" : String(data.fila.Inventario));
        setComentario(data.fila.Comentario == null ? "" : String(data.fila.Comentario));
      })
      .catch((err) => setError(err.message || "No se pudo cargar el material."))
      .finally(() => setCargando(false));
  }, [codigo]);

  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: "32px 24px",
        fontFamily: "Segoe UI, sans-serif",
        background: "#f4f6f8",
        color: "#111111",
      }}
    >
      <Link to="/" style={{ color: "#1d4ed8", textDecoration: "none" }}>
        Volver al inventario
      </Link>
      <h1 style={{ margin: "16px 0 20px", fontSize: 24 }}>Material {codigo}</h1>
      {cargando && <p>Cargando detalle...</p>}
      {error && <p>{error}</p>}
      {!cargando && !error && fila && (
        <dl
          style={{
            margin: 0,
            maxWidth: 640,
            background: "#fff",
            borderRadius: 8,
            padding: "8px 20px",
          }}
        >
          {columnas.map((columna) => (
            <div
              key={columna}
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                gap: 12,
                padding: "12px 0",
                borderBottom: "1px solid #e6e8ec",
              }}
            >
              <dt style={{ fontWeight: 600 }}>{columna}</dt>
              <dd style={{ margin: 0 }}>
                {fila[columna] === "" || fila[columna] == null ? "—" : fila[columna]}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {!cargando && !error && fila && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setAviso("");
            setGuardando(true);
            fetch(`/api/material/${encodeURIComponent(codigo)}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ inventario, comentario }),
            })
              .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
                setFila(data.fila);
                setInventario(data.fila.Inventario == null ? "" : String(data.fila.Inventario));
                setComentario(data.fila.Comentario == null ? "" : String(data.fila.Comentario));
                setAviso("Cambios guardados en la tabla.");
              })
              .catch((err) => setAviso(err.message))
              .finally(() => setGuardando(false));
          }}
          style={{
            marginTop: 20,
            maxWidth: 640,
            background: "#fff",
            borderRadius: 8,
            padding: 20,
            display: "grid",
            gap: 16,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            Inventario
            <input
              value={inventario}
              inputMode="numeric"
              onChange={(event) => {
                const valor = event.target.value;
                if (valor === "" || /^-?\d+$/.test(valor)) setInventario(valor);
              }}
              style={{ padding: "8px 12px", border: "1px solid #d0d5dd", borderRadius: 6, fontSize: 14 }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Comentario
            <textarea
              value={comentario}
              rows={4}
              onChange={(event) => setComentario(event.target.value)}
              style={{ padding: "8px 12px", border: "1px solid #d0d5dd", borderRadius: 6, fontSize: 14, resize: "vertical" }}
            />
          </label>
          <button
            type="submit"
            disabled={guardando || !/^-?\d+$/.test(inventario)}
            style={{
              justifySelf: "start",
              padding: "8px 14px",
              border: 0,
              borderRadius: 6,
              background: "#1d4ed8",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
          {aviso && <p style={{ margin: 0 }}>{aviso}</p>}
        </form>
      )}
    </main>
  );
}
