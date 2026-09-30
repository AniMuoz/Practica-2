import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar.jsx";

export default function App() {
  const navigate = useNavigate();
  const [columnas, setColumnas] = useState([]);
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [orden, setOrden] = useState("");
  const [subUbicacion, setSubUbicacion] = useState("");
  const [stockMinimo, setStockMinimo] = useState("");
  const [soloConPrecio, setSoloConPrecio] = useState(false);
  const [soloConUbicacion, setSoloConUbicacion] = useState(false);
  const tamano = 100;

  const subUbicaciones = useMemo(() => {
    const valores = new Set(
      filas.map((fila) => String(fila["Sub-ubicación"] ?? "").trim()).filter(Boolean)
    );
    return [...valores].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  }, [filas]);

  const visibles = useMemo(() => {
    let lista = filas;
    if (subUbicacion) {
      lista = lista.filter((fila) => String(fila["Sub-ubicación"] ?? "").trim() === subUbicacion);
    }
    if (stockMinimo.trim() !== "") {
      const minimo = Number(stockMinimo);
      lista = lista.filter((fila) => {
        const stock = Number(String(fila.Stock ?? "").trim());
        return Number.isFinite(stock) && stock >= minimo;
      });
    }
    if (soloConPrecio) {
      lista = lista.filter((fila) => String(fila.Precio ?? "").trim() !== "");
    }
    if (soloConUbicacion) {
      lista = lista.filter((fila) => String(fila["Ubicación"] ?? "").trim() !== "");
    }
    if (orden === "codigo" || orden === "codigo-asc") {
      const sentido = orden === "codigo" ? -1 : 1;
      lista = [...lista].sort((a, b) => {
        const na = Number(a.Codigo);
        const nb = Number(b.Codigo);
        const comparado = Number.isFinite(na) && Number.isFinite(nb)
          ? na - nb
          : String(a.Codigo).localeCompare(String(b.Codigo), "es", { numeric: true });
        return comparado * sentido;
      });
    } else if (orden === "descripcion" || orden === "descripcion-desc") {
      const sentido = orden === "descripcion" ? 1 : -1;
      lista = [...lista].sort((a, b) =>
        String(a.Descripcion ?? "").localeCompare(String(b.Descripcion ?? ""), "es", { sensitivity: "base" }) * sentido
      );
    }
    return lista;
  }, [filas, orden, subUbicacion, stockMinimo, soloConPrecio, soloConUbicacion]);

  useEffect(() => {
    setPagina(0);
  }, [orden, subUbicacion, stockMinimo, soloConPrecio, soloConUbicacion]);

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

  const alFinal = (pagina + 1) * tamano >= visibles.length;
  const rango =
    visibles.length === 0
      ? "0 de 0"
      : `${pagina * tamano + 1}–${Math.min((pagina + 1) * tamano, visibles.length)} de ${visibles.length}`;

  function paginacion() {
    return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px" }}>
      <button
        type="button"
        disabled={pagina === 0}
        onClick={() => setPagina((actual) => actual - 1)}
        style={{
          padding: "6px 12px",
          border: 0,
          borderRadius: 6,
          background: pagina === 0 ? "#e5e7eb" : "#111827",
          color: pagina === 0 ? "#6b7280" : "#fff",
          fontSize: 14,
          cursor: pagina === 0 ? "default" : "pointer",
        }}
      >
        Anterior
      </button>
      <span style={{ fontSize: 14 }}>{rango}</span>
      <button
        type="button"
        disabled={alFinal}
        onClick={() => setPagina((actual) => actual + 1)}
        style={{
          padding: "6px 12px",
          border: 0,
          borderRadius: 6,
          background: alFinal ? "#e5e7eb" : "#111827",
          color: alFinal ? "#6b7280" : "#fff",
          fontSize: 14,
          cursor: alFinal ? "default" : "pointer",
        }}
      >
        Siguiente
      </button>
    </div>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: 16,
        fontFamily: "Segoe UI, sans-serif",
        background: "#f4f6f8",
        color: "#111111",
      }}
    >
      <Navbar />
      <a
        href="/api/tabla/excel"
        style={{
          display: "inline-block",
          marginBottom: 16,
          padding: "8px 14px",
          borderRadius: 6,
          background: "#0f766e",
          color: "#fff",
          fontSize: 14,
          textDecoration: "none",
        }}
      >
        Descargar planilla
      </a>
      {!cargando && !error && filas.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setFiltrosAbiertos((abierto) => !abierto)}
            style={{
              padding: "8px 14px",
              border: 0,
              borderRadius: 6,
              background: "#111827",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {filtrosAbiertos ? "Ocultar filtros" : "Filtros"}
          </button>
          {filtrosAbiertos && (
            <div
              style={{
                marginTop: 10,
                background: "#fff",
                borderRadius: 8,
                padding: 16,
                display: "grid",
                gap: 12,
              }}
            >
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                <input
                  type="radio"
                  name="orden"
                  checked={orden === ""}
                  onChange={() => setOrden("")}
                />
                Sin orden extra
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                <input
                  type="radio"
                  name="orden"
                  checked={orden === "codigo"}
                  onChange={() => setOrden("codigo")}
                />
                Ordenar códigos de mayor a menor
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                <input
                  type="radio"
                  name="orden"
                  checked={orden === "codigo-asc"}
                  onChange={() => setOrden("codigo-asc")}
                />
                Ordenar códigos de menor a mayor
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                <input
                  type="radio"
                  name="orden"
                  checked={orden === "descripcion"}
                  onChange={() => setOrden("descripcion")}
                />
                Ordenar descripciones alfabéticamente
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                <input
                  type="radio"
                  name="orden"
                  checked={orden === "descripcion-desc"}
                  onChange={() => setOrden("descripcion-desc")}
                />
                Ordenar descripciones alfabéticamente al revés
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 14, maxWidth: 280 }}>
                Sub-ubicación
                <select
                  value={subUbicacion}
                  onChange={(event) => setSubUbicacion(event.target.value)}
                  style={{ padding: "8px 10px", border: "1px solid #d0d5dd", borderRadius: 6, fontSize: 14 }}
                >
                  <option value="">Todas</option>
                  {subUbicaciones.map((valor) => (
                    <option key={valor} value={valor}>
                      {valor}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 14, maxWidth: 280 }}>
                Stock igual o mayor a
                <input
                  inputMode="decimal"
                  value={stockMinimo}
                  placeholder="Cualquier stock"
                  onChange={(event) => {
                    const valor = event.target.value;
                    if (valor === "" || /^-?\d*\.?\d*$/.test(valor)) setStockMinimo(valor);
                  }}
                  style={{ padding: "8px 10px", border: "1px solid #d0d5dd", borderRadius: 6, fontSize: 14 }}
                />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={soloConPrecio}
                  onChange={(event) => setSoloConPrecio(event.target.checked)}
                />
                Mostrar solo materiales con precio
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={soloConUbicacion}
                  onChange={(event) => setSoloConUbicacion(event.target.checked)}
                />
                Mostrar solo materiales con ubicación
              </label>
              <button
                type="button"
                onClick={() => {
                  setOrden("");
                  setSubUbicacion("");
                  setStockMinimo("");
                  setSoloConPrecio(false);
                  setSoloConUbicacion(false);
                }}
                style={{
                  justifySelf: "start",
                  padding: "8px 14px",
                  border: 0,
                  borderRadius: 6,
                  background: "#e5e7eb",
                  color: "#111827",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}
      {cargando && <p>Cargando tabla...</p>}
      {error && <p>{error}</p>}
      {!cargando && !error && filas.length === 0 && <p>La tabla está vacía.</p>}
      {!cargando && !error && filas.length > 0 && (
        <div className="tabla-inventario" style={{ overflowX: "auto", background: "#fff", borderRadius: 8 }}>
          {paginacion()}
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
              {visibles.slice(pagina * tamano, pagina * tamano + tamano).map((fila) => (
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
          {paginacion()}
        </div>
      )}
      <div class="footer">
        <p>© 2026 Berfre - Práctica 2 - Python y HTML - Anibal Alexis Muñoz Reyes - UNAB</p>
    </div>
    </main>
  );
}
