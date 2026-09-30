import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function App() {
  const navigate = useNavigate();
  const [columnas, setColumnas] = useState([]);
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch("/api/tabla")
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo leer la API");
        return res.json();
      })
      .then((data) => {
        setColumnas(data.columnas || []);
        setFilas(data.filas || []);
      })
      .catch(() => setError("No se pudo cargar la tabla."))
      .finally(() => setCargando(false));
  }, []);

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
      <h1 style={{ margin: "0 0 20px", fontSize: 24 }}>Inventario</h1>
      {cargando && <p>Cargando tabla...</p>}
      {error && <p>{error}</p>}
      {!cargando && !error && filas.length === 0 && <p>La tabla está vacía.</p>}
      {!cargando && !error && filas.length > 0 && (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 8 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
            <thead>
              <tr>
                {columnas.map((columna) => (
                  <th
                    key={columna}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderBottom: "2px solid #d0d5dd",
                      background: "#eef2f6",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr
                  key={fila.Codigo}
                  onClick={() => navigate(`/${encodeURIComponent(fila.Codigo)}`)}
                  style={{ cursor: "pointer" }}
                >
                  {columnas.map((columna) => (
                    <td
                      key={columna}
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid #e6e8ec",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fila[columna] === "" || fila[columna] == null ? "—" : fila[columna]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
