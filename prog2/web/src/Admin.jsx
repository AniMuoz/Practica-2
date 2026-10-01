import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar.jsx";

const IMAGENES = new Set(["Rombo", "QR"]);

export default function Admin() {
  const navigate = useNavigate();
  const [autorizado, setAutorizado] = useState(false);
  const [clave, setClave] = useState("");
  const [columnas, setColumnas] = useState([]);
  const [datos, setDatos] = useState({});
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [importando, setImportando] = useState(false);
  const [avisoCarga, setAvisoCarga] = useState("");
  const [modoCarga, setModoCarga] = useState("completa");
  const [columnaCarga, setColumnaCarga] = useState("");
  const [columnasDestino, setColumnasDestino] = useState([]);
  const [mostrarCarga, setMostrarCarga] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarBodega, setMostrarBodega] = useState(false);
  const [bodega, setBodega] = useState({ columnas: [], filas: [] });
  const [cargandoBodega, setCargandoBodega] = useState(false);
  const [avisoBodega, setAvisoBodega] = useState("");
  const [mostrarRegional, setMostrarRegional] = useState(false);
  const [regional, setRegional] = useState({ columnas: [], filas: [] });
  const [cargandoRegional, setCargandoRegional] = useState(false);
  const [avisoRegional, setAvisoRegional] = useState("");
  const [mostrarInventario, setMostrarInventario] = useState(false);
  const [inventario, setInventario] = useState({ columnas: [], filas: [] });
  const [cargandoInventario, setCargandoInventario] = useState(false);
  const [avisoInventario, setAvisoInventario] = useState("");
  const [mostrarDetallado, setMostrarDetallado] = useState(false);
  const [detallado, setDetallado] = useState({ columnas: [], filas: [] });
  const [cargandoDetallado, setCargandoDetallado] = useState(false);
  const [avisoDetallado, setAvisoDetallado] = useState("");

  useEffect(() => {
    if (!autorizado) return;
    fetch("/api/tabla")
      .then((res) => res.json())
      .then((data) => {
        const lista = (data.columnas || []).filter((columna) => !IMAGENES.has(columna));
        setColumnas(lista);
        const destino = (data.columnas || []).filter(
          (columna) => !["Codigo", "Inventario", "Comentario"].includes(columna)
        );
        setColumnasDestino(destino);
        setColumnaCarga((actual) => (destino.includes(actual) ? actual : destino[0] || ""));
        const vacios = {};
        lista.forEach((columna) => {
          vacios[columna] = "";
        });
        setDatos(vacios);
      })
      .catch(() => setAviso("No se pudo cargar la tabla."));
  }, [autorizado]);

  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        margin: 0,
        padding: 16,
        fontFamily: "Segoe UI, sans-serif",
        background: "#f4f6f8",
        color: "#111111",
      }}
    >
      <Navbar />
      <h1 style={{ margin: "0 0 16px", fontSize: 22 }}>Agregar material</h1>
      {!autorizado && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (clave !== "Berfre2026") {
              setAviso("Contraseña incorrecta.");
              return;
            }
            setAviso("");
            setAutorizado(true);
          }}
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          <input
            type="password"
            value={clave}
            autoFocus
            placeholder="Contraseña"
            onChange={(event) => setClave(event.target.value)}
            style={{ padding: "8px 12px", border: "1px solid #d0d5dd", borderRadius: 6, fontSize: 14 }}
          />
          <button
            type="submit"
            style={{
              padding: "8px 14px",
              border: 0,
              borderRadius: 6,
              background: "#1d4ed8",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Entrar
          </button>
          {aviso && <p style={{ margin: 0 }}>{aviso}</p>}
        </form>
      )}
      {autorizado && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {[
            "Añadir un dato",
            "Carga de datos",
            "Stock en bodega",
            "Stock regional",
            "Planilla de inventario",
            "Stock detallado",
            "Revisar stock de reserva",
            "Planilla de ventas",
          ].map((nombre) => {
            const activo =
              (nombre === "Carga de datos" && mostrarCarga) ||
              (nombre === "Añadir un dato" && mostrarFormulario) ||
              (nombre === "Stock en bodega" && mostrarBodega) ||
              (nombre === "Stock regional" && mostrarRegional) ||
              (nombre === "Planilla de inventario" && mostrarInventario) ||
              (nombre === "Stock detallado" && mostrarDetallado);
            return (
              <button
                key={nombre}
                type="button"
                onClick={() => {
                  if (nombre === "Carga de datos") setMostrarCarga((actual) => !actual);
                  if (nombre === "Añadir un dato") setMostrarFormulario((actual) => !actual);
                  if (nombre === "Stock en bodega") {
                    setMostrarBodega((actual) => {
                      const abrir = !actual;
                      if (abrir) {
                        setCargandoBodega(true);
                        setAvisoBodega("");
                        fetch("/api/bodega")
                          .then(async (res) => {
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || "No se pudo leer el stock.");
                            setBodega({ columnas: data.columnas || [], filas: data.filas || [] });
                          })
                          .catch((err) => setAvisoBodega(err.message))
                          .finally(() => setCargandoBodega(false));
                      }
                      return abrir;
                    });
                  }
                  if (nombre === "Stock regional") {
                    setMostrarRegional((actual) => {
                      const abrir = !actual;
                      if (abrir) {
                        setCargandoRegional(true);
                        setAvisoRegional("");
                        fetch("/api/regional")
                          .then(async (res) => {
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || "No se pudo leer el stock regional.");
                            setRegional({ columnas: data.columnas || [], filas: data.filas || [] });
                          })
                          .catch((err) => setAvisoRegional(err.message))
                          .finally(() => setCargandoRegional(false));
                      }
                      return abrir;
                    });
                  }
                  if (nombre === "Planilla de inventario") {
                    setMostrarInventario((actual) => {
                      const abrir = !actual;
                      if (abrir) {
                        setCargandoInventario(true);
                        setAvisoInventario("");
                        fetch("/api/inventario")
                          .then(async (res) => {
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || "No se pudo leer el inventario.");
                            setInventario({ columnas: data.columnas || [], filas: data.filas || [] });
                          })
                          .catch((err) => setAvisoInventario(err.message))
                          .finally(() => setCargandoInventario(false));
                      }
                      return abrir;
                    });
                  }
                  if (nombre === "Stock detallado") {
                    setMostrarDetallado((actual) => {
                      const abrir = !actual;
                      if (abrir) {
                        setCargandoDetallado(true);
                        setAvisoDetallado("");
                        fetch("/api/stock-detallado")
                          .then(async (res) => {
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || "No se pudo leer el stock detallado.");
                            setDetallado({ columnas: data.columnas || [], filas: data.filas || [] });
                          })
                          .catch((err) => setAvisoDetallado(err.message))
                          .finally(() => setCargandoDetallado(false));
                      }
                      return abrir;
                    });
                  }
                }}
                style={{
                  padding: "8px 14px",
                  border: activo ? "1px solid #1d4ed8" : "1px solid #d0d5dd",
                  borderRadius: 6,
                  background: activo ? "#1d4ed8" : "#fff",
                  color: activo ? "#fff" : "#111827",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {nombre}
              </button>
            );
          })}
        </div>
      )}
      {autorizado && mostrarCarga && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!archivo) {
              setAvisoCarga("Elegí un archivo .xlsx.");
              return;
            }
            if (modoCarga === "dos-columnas" && !columnaCarga) {
              setAvisoCarga("Elegí la columna que va a llenar la planilla.");
              return;
            }
            setAvisoCarga("");
            setImportando(true);
            const cuerpo = new FormData();
            cuerpo.append("clave", clave);
            cuerpo.append("modo", modoCarga);
            if (modoCarga === "dos-columnas") cuerpo.append("columna", columnaCarga);
            cuerpo.append("archivo", archivo);
            fetch("/api/tabla/excel", { method: "POST", body: cuerpo })
              .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "No se pudo importar.");
                setArchivo(null);
                event.target.reset();
                const omitidos = data.omitidos ? `, ${data.omitidos} omitidos` : "";
                setAvisoCarga(`Listo: ${data.agregados} nuevos, ${data.actualizados} actualizados${omitidos}.`);
              })
              .catch((err) => setAvisoCarga(err.message))
              .finally(() => setImportando(false));
          }}
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
          }}
        >
          <strong style={{ fontSize: 14 }}>Carga masiva</strong>
          <select
            aria-label="Tipo de planilla"
            value={modoCarga}
            onChange={(event) => setModoCarga(event.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #d0d5dd", borderRadius: 6, fontSize: 14 }}
          >
            <option value="completa">Planilla completa</option>
            <option value="sap">Planilla EXPORT SAP</option>
            <option value="ubicaciones">Planilla de ubicaciones</option>
            <option value="precios">Planilla de precios</option>
            <option value="dos-columnas">Planilla de 2 columnas</option>
          </select>
          {modoCarga === "dos-columnas" && (
            <select
              aria-label="Columna a llenar"
              value={columnaCarga}
              onChange={(event) => setColumnaCarga(event.target.value)}
              style={{ padding: "8px 10px", border: "1px solid #d0d5dd", borderRadius: 6, fontSize: 14 }}
            >
              {columnasDestino.map((columna) => (
                <option key={columna} value={columna}>
                  {columna}
                </option>
              ))}
            </select>
          )}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => setArchivo(event.target.files?.[0] || null)}
          />
          <button
            type="submit"
            disabled={importando}
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
            {importando ? "Importando..." : "Importar planilla"}
          </button>
          {avisoCarga && <p style={{ margin: 0, fontSize: 14 }}>{avisoCarga}</p>}
        </form>
      )}
      {autorizado && mostrarBodega && (
        <section
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Bodega M501</h2>
            <a
              href="/api/bodega/excel"
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                background: "#111827",
                color: "#fff",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Descargar planilla
            </a>
          </div>
          {cargandoBodega && <p style={{ margin: 0 }}>Cargando stock...</p>}
          {avisoBodega && <p style={{ margin: 0 }}>{avisoBodega}</p>}
          {!cargandoBodega && !avisoBodega && (
            <div style={{ overflow: "auto", maxHeight: 480 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr>
                    {bodega.columnas.map((columna) => (
                      <th
                        key={columna}
                        style={{
                          position: "sticky",
                          top: 0,
                          textAlign: "left",
                          padding: "8px 10px",
                          background: "#a9e5e5",
                          border: "1px solid #d0d5dd",
                        }}
                      >
                        {columna}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodega.filas.map((fila, indice) => {
                    const libre = fila[2];
                    const fondo =
                      libre === 0 || libre === "0" ? "#d3d3d3" : libre === "          " ? "#f9e37c" : "#73c883";
                    return (
                      <tr key={`${fila[0]}-${indice}`}>
                        {fila.map((valor, columna) => (
                          <td
                            key={columna}
                            style={{
                              padding: "8px 10px",
                              border: "1px solid #e5e7eb",
                              background: columna === 2 ? fondo : "#fff",
                            }}
                          >
                            {valor === "" || valor == null ? "" : String(valor)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {bodega.filas.length === 0 && <p style={{ margin: "12px 0 0" }}>No hay stock de M501 cargado.</p>}
            </div>
          )}
        </section>
      )}
      {autorizado && mostrarRegional && (
        <section
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Stock por bodega</h2>
            <a
              href="/api/regional/excel"
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                background: "#111827",
                color: "#fff",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Descargar planilla
            </a>
          </div>
          {cargandoRegional && <p style={{ margin: 0 }}>Cargando stock...</p>}
          {avisoRegional && <p style={{ margin: 0 }}>{avisoRegional}</p>}
          {!cargandoRegional && !avisoRegional && (
            <div style={{ overflow: "auto", maxHeight: 480 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr>
                    {regional.columnas.map((columna) => (
                      <th
                        key={columna}
                        style={{
                          position: "sticky",
                          top: 0,
                          textAlign: "left",
                          padding: "8px 10px",
                          background: "#a9e5e5",
                          border: "1px solid #d0d5dd",
                        }}
                      >
                        {columna}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {regional.filas.map((fila, indice) => (
                    <tr key={`${fila[0]}-${indice}`}>
                      {fila.map((valor, columna) => {
                        const fondo =
                          columna < 2
                            ? "#fff"
                            : valor === 0 || valor === "0"
                              ? "#d3d3d3"
                              : valor == null || valor === "" || valor === "          "
                                ? "#f9e37c"
                                : "#73c883";
                        return (
                          <td
                            key={columna}
                            style={{
                              padding: "8px 10px",
                              border: "1px solid #e5e7eb",
                              background: fondo,
                              fontWeight: columna === fila.length - 1 ? 700 : 400,
                            }}
                          >
                            {valor === "" || valor == null ? "" : String(valor)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {regional.filas.length === 0 && <p style={{ margin: "12px 0 0" }}>No hay stock regional cargado.</p>}
            </div>
          )}
        </section>
      )}
      {autorizado && mostrarInventario && (
        <section
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Inventario por lugar</h2>
            <a
              href="/api/inventario/excel"
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                background: "#111827",
                color: "#fff",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Descargar planilla
            </a>
          </div>
          {cargandoInventario && <p style={{ margin: 0 }}>Cargando inventario...</p>}
          {avisoInventario && <p style={{ margin: 0 }}>{avisoInventario}</p>}
          {!cargandoInventario && !avisoInventario && (
            <div style={{ overflow: "auto", maxHeight: 480 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr>
                    {inventario.columnas.map((columna) => (
                      <th
                        key={columna}
                        style={{
                          position: "sticky",
                          top: 0,
                          textAlign: "left",
                          padding: "8px 10px",
                          background: "#a9e5e5",
                          border: "1px solid #d0d5dd",
                        }}
                      >
                        {columna}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventario.filas.map((fila, indice) => (
                    <tr key={`${fila[0]}-${indice}`}>
                      {fila.map((valor, columna) => (
                        <td
                          key={columna}
                          style={{
                            padding: "8px 10px",
                            border: "1px solid #e5e7eb",
                            background:
                              (columna === 2 || columna === 3) && String(valor ?? "").trim() === "" ? "#f9e37c" : "#fff",
                          }}
                        >
                          {valor === "" || valor == null ? "" : String(valor)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {inventario.filas.length === 0 && <p style={{ margin: "12px 0 0" }}>No hay materiales para inventariar.</p>}
            </div>
          )}
        </section>
      )}
      {autorizado && mostrarDetallado && (
        <section
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Stock detallado</h2>
            <a
              href="/api/stock-detallado/excel"
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                background: "#111827",
                color: "#fff",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Descargar planilla
            </a>
          </div>
          {cargandoDetallado && <p style={{ margin: 0 }}>Cargando stock...</p>}
          {avisoDetallado && <p style={{ margin: 0 }}>{avisoDetallado}</p>}
          {!cargandoDetallado && !avisoDetallado && (
            <div style={{ overflow: "auto", maxHeight: 480 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr>
                    {detallado.columnas.map((columna) => (
                      <th
                        key={columna}
                        style={{
                          position: "sticky",
                          top: 0,
                          textAlign: "left",
                          padding: "8px 10px",
                          background: "#a9e5e5",
                          border: "1px solid #d0d5dd",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {columna}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detallado.filas.map((fila, indice) => (
                    <tr key={`${fila[1]}-${indice}`}>
                      {fila.map((valor, columna) => {
                        const coloreada = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(columna);
                        const fondo = !coloreada
                          ? "#fff"
                          : valor === 0 || valor === "0"
                            ? "#d3d3d3"
                            : valor == null || valor === "" || valor === "          " || valor === "Sin precio"
                              ? "#f9e37c"
                              : "#73c883";
                        return (
                          <td
                            key={columna}
                            style={{
                              padding: "8px 10px",
                              border: "1px solid #e5e7eb",
                              background: fondo,
                              fontWeight: columna === 10 ? 700 : 400,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {valor === "" || valor == null ? "" : String(valor)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {detallado.filas.length === 0 && <p style={{ margin: "12px 0 0" }}>No hay stock detallado cargado.</p>}
            </div>
          )}
        </section>
      )}
      {autorizado && mostrarFormulario && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setAviso("");
            setGuardando(true);
            fetch("/api/material", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clave, datos }),
            })
              .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "No se pudo agregar.");
                navigate(`/${encodeURIComponent(data.fila.Codigo)}`);
              })
              .catch((err) => setAviso(err.message))
              .finally(() => setGuardando(false));
          }}
          className="form-admin"
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: 16,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {columnas.map((columna) => (
            <label key={columna} style={{ display: "grid", gap: 4, fontSize: 13 }}>
              {columna}
              <input
                value={datos[columna] ?? ""}
                inputMode={columna === "Inventario" ? "numeric" : "text"}
                onChange={(event) => {
                  const valor = event.target.value;
                  if (columna === "Inventario" && valor !== "" && !/^-?\d+$/.test(valor)) return;
                  setDatos((actual) => ({ ...actual, [columna]: valor }));
                }}
                style={{
                  padding: "8px 10px",
                  border: "1px solid #d0d5dd",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </label>
          ))}
          <div style={{ display: "flex", alignItems: "end", gap: 12 }}>
            <button
              type="submit"
              disabled={guardando}
              style={{
                padding: "8px 14px",
                border: 0,
                borderRadius: 6,
                background: "#1d4ed8",
                color: "#fff",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {guardando ? "Guardando..." : "Agregar"}
            </button>
            {aviso && <p style={{ margin: 0, fontSize: 14 }}>{aviso}</p>}
          </div>
        </form>
      )}
      <div className="footer">
        <p>© 2026 Berfre - Práctica 2 - Python y HTML - Anibal Alexis Muñoz Reyes - UNAB</p>
    </div>
    </main>
  );
}
