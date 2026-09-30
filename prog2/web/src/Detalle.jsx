import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

export default function Detalle() {
  const { codigo } = useParams();
  const [columnas, setColumnas] = useState([]);
  const [fila, setFila] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

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
    </main>
  );
}
