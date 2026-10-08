import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useColoresPlanilla } from "./ColoresPlanilla.jsx";
import Navbar from "./Navbar.jsx";
import Planilla from "./Planilla.jsx";
import { iniciarRecorrido, recorridoPendiente } from "./Recorrido.jsx";
import {
  aplicarFilaRecibida,
  bodegasDe,
  colorCelda as colorDeCelda,
  columnasSinImagen,
  consultaExcel,
  filtrarFilas,
  rangoPagina,
  subUbicacionesDe,
} from "./reglasPlanilla.js";

export default function App() {
  const navigate = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const texto = parametros.get("q") || "";
  const { colores, oscuro } = useColoresPlanilla();
  const [columnas, setColumnas] = useState([]);
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [orden, setOrden] = useState("codigo-asc");
  const [bodega, setBodega] = useState("");
  const [subUbicacion, setSubUbicacion] = useState("");
  const [stockMinimo, setStockMinimo] = useState("");
  const [soloConPrecio, setSoloConPrecio] = useState(false);
  const [soloConUbicacion, setSoloConUbicacion] = useState(false);
  const [soloStockCritico, setSoloStockCritico] = useState(false);
  const [soloInventarioOComentario, setSoloInventarioOComentario] = useState(false);
  const [soloMarcados, setSoloMarcados] = useState(false);
  const [ignorarNulo, setIgnorarNulo] = useState(true);
  const [bloquearPagina, setBloquearPagina] = useState(false);
  const [limpiando, setLimpiando] = useState(false);
  const [pedirClave, setPedirClave] = useState(false);
  const [clave, setClave] = useState("");
  const [avisoClave, setAvisoClave] = useState("");
  const tamano = 100;

  function colorCelda(columna, fila) {
    return colorDeCelda(columna, fila, oscuro);
  }

  const bodegas = useMemo(() => bodegasDe(filas), [filas]);

  const subUbicaciones = useMemo(() => subUbicacionesDe(filas, bodega), [filas, bodega]);

  useEffect(() => {
    if (subUbicacion && !subUbicaciones.includes(subUbicacion)) setSubUbicacion("");
  }, [subUbicacion, subUbicaciones]);

  const visibles = useMemo(
    () => filtrarFilas(filas, {
      orden,
      bodega,
      subUbicacion,
      stockMinimo,
      soloConPrecio,
      soloConUbicacion,
      soloStockCritico,
      soloInventarioOComentario,
      soloMarcados,
      ignorarNulo,
      texto,
    }),
    [filas, orden, bodega, subUbicacion, stockMinimo, soloConPrecio, soloConUbicacion, soloStockCritico, soloInventarioOComentario, soloMarcados, ignorarNulo, texto]
  );

  useEffect(() => {
    setPagina(0);
  }, [orden, bodega, subUbicacion, stockMinimo, soloConPrecio, soloConUbicacion, soloStockCritico, soloInventarioOComentario, soloMarcados, ignorarNulo, texto]);

  function cargarTabla() {
    return fetch("/api/tabla", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo leer la API");
        return res.json();
      })
      .then((data) => {
        setColumnas(data.columnas || []);
        setFilas(data.filas || []);
      });
  }

  useEffect(() => {
    cargarTabla()
      .catch(() => setError("No se pudo cargar la tabla."))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (cargando || error || filas.length === 0) return;
    if (recorridoPendiente("principal")) iniciarRecorrido("principal");
  }, [cargando, error, filas.length]);

  useEffect(() => {
    const fuente = new EventSource("/api/eventos");
    fuente.onmessage = (evento) => {
      let data;
      try {
        data = JSON.parse(evento.data);
      } catch {
        return;
      }
      if (data.tipo === "fila" && data.fila) {
        setFilas((actuales) => aplicarFilaRecibida(actuales, data));
        return;
      }
      if (data.tipo === "recarga") {
        cargarTabla().catch(() => setError("No se pudo actualizar la tabla."));
      }
    };
    return () => fuente.close();
  }, []);

  const columnasTabla = columnasSinImagen(columnas);
  const alFinal = (pagina + 1) * tamano >= visibles.length;
  const rango = rangoPagina(pagina, tamano, visibles.length);

  function limpiarInventario(event) {
    event.preventDefault();
    if (!window.confirm("¿Vaciar las columnas Inventario y Comentario de todos los materiales?")) return;
    setLimpiando(true);
    setError("");
    setAvisoClave("");
    fetch("/api/tabla/limpiar-inventario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "No se pudo limpiar");
        return data;
      })
      .then((data) => {
        setColumnas(data.columnas || []);
        setFilas(data.filas || []);
        setPedirClave(false);
        setClave("");
      })
      .catch((error) => {
        const mensaje = error.message || "No se pudieron limpiar inventario y comentarios.";
        if (mensaje === "Contraseña incorrecta.") setAvisoClave(mensaje);
        else setError(mensaje);
      })
      .finally(() => setLimpiando(false));
  }

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
          background: pagina === 0 ? "var(--apagado)" : "var(--boton)",
          color: pagina === 0 ? "var(--apagado-texto)" : "var(--sobre)",
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
          background: alFinal ? "var(--apagado)" : "var(--boton)",
          color: alFinal ? "var(--apagado-texto)" : "var(--sobre)",
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
        background: "var(--fondo)",
        color: "var(--texto)",
      }}
    >
      <Navbar />
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {!cargando && !error && filas.length > 0 && (
            <button
              type="button"
              data-tour="filtros"
              onClick={() => setFiltrosAbiertos((abierto) => !abierto)}
              style={{
                padding: "8px 14px",
                border: 0,
                borderRadius: 6,
                background: "var(--boton)",
                color: "var(--sobre)",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {filtrosAbiertos ? "Ocultar filtros" : "Filtros"}
            </button>
          )}
          {!cargando && !error && filas.length > 0 && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={bloquearPagina}
                onChange={(event) => setBloquearPagina(event.target.checked)}
              />
              Bloquear pagina de material
            </label>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginLeft: "auto" }}>
            <button
              type="button"
              disabled={cargando || limpiando}
              data-tour="limpiar"
              onClick={() => {
                setAvisoClave("");
                setClave("");
                setPedirClave(true);
              }}
              style={{
                padding: "8px 14px",
                border: 0,
                borderRadius: 6,
                background: cargando || limpiando ? "var(--apagado)" : "var(--peligro)",
                color: cargando || limpiando ? "var(--apagado-texto)" : "var(--sobre)",
                fontSize: 14,
                cursor: cargando || limpiando ? "default" : "pointer",
              }}
            >
              {limpiando ? "Limpiando..." : "Limpiar inventario y comentarios"}
            </button>
            <a
              data-tour="descargar"
              href={consultaExcel({
                colores,
                orden,
                bodega,
                subUbicacion,
                stockMinimo,
                soloConPrecio,
                soloConUbicacion,
                soloStockCritico,
                soloInventarioOComentario,
                soloMarcados,
                ignorarNulo,
                texto,
              })}
              style={{
                display: "inline-block",
                padding: "8px 14px",
                borderRadius: 6,
                background: "var(--descarga)",
                color: "var(--sobre)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Descargar planilla
            </a>
          </div>
        </div>
      {!cargando && !error && filas.length > 0 && (
        <>
          {filtrosAbiertos && (
            <div className="filtros-panel">
              <div className="filtros-col">
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
              </div>
              <div className="filtros-col filtros-campos">
                <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
                  Bodega
                  <select
                    value={bodega}
                    onChange={(event) => setBodega(event.target.value)}
                    style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
                  >
                    <option value="">Todas</option>
                    {bodegas.map((valor) => (
                      <option key={valor} value={valor}>
                        {valor}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
                  Sub-ubicación
                  <select
                    value={subUbicacion}
                    onChange={(event) => setSubUbicacion(event.target.value)}
                    style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
                  >
                    <option value="">Todas</option>
                    {subUbicaciones.map((valor) => (
                      <option key={valor} value={valor}>
                        {valor}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
                  Stock igual o mayor a
                  <input
                    inputMode="decimal"
                    value={stockMinimo}
                    placeholder="Cualquier stock"
                    onChange={(event) => {
                      const valor = event.target.value;
                      if (valor === "" || /^-?\d*\.?\d*$/.test(valor)) setStockMinimo(valor);
                    }}
                    style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
                  />
                </label>
              </div>
              <div className="filtros-col">
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
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={soloStockCritico}
                    onChange={(event) => setSoloStockCritico(event.target.checked)}
                  />
                  Mostrar material en stock crítico
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={soloInventarioOComentario}
                    onChange={(event) => setSoloInventarioOComentario(event.target.checked)}
                  />
                  Mostrar solo materiales con inventario o comentario
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={soloMarcados}
                    onChange={(event) => setSoloMarcados(event.target.checked)}
                  />
                  Mostrar solo materiales marcados
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={ignorarNulo}
                    onChange={(event) => setIgnorarNulo(event.target.checked)}
                  />
                  Ignorar descripciones NULO
                </label>
              </div>
              <button
                type="button"
                className="filtros-limpiar"
                onClick={() => {
                  setOrden("codigo-asc");
                  setBodega("");
                  setSubUbicacion("");
                  setStockMinimo("");
                  setSoloConPrecio(false);
                  setSoloConUbicacion(false);
                  setSoloStockCritico(false);
                  setSoloInventarioOComentario(false);
                  setSoloMarcados(false);
                  setIgnorarNulo(true);
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </>
      )}
      </div>
      {cargando && <p>Cargando tabla...</p>}
      {error && <p>{error}</p>}
      {!cargando && !error && filas.length === 0 && <p>La tabla está vacía.</p>}
      {!cargando && !error && filas.length > 0 && texto.trim().length >= 2 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "0 0 12px" }}>
          <button
            type="button"
            onClick={() => {
              const siguientes = new URLSearchParams(parametros);
              siguientes.delete("q");
              setParametros(siguientes);
            }}
            style={{
              padding: "8px 14px",
              border: "2px solid var(--acento)",
              borderRadius: 6,
              background: "var(--superficie)",
              color: "var(--texto)",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Quitar búsqueda y ver todos los productos
          </button>
          <p style={{ margin: 0, fontSize: 14 }}>
            {visibles.length === 0
              ? `Ningún producto coincide con «${texto.trim()}».`
              : `${visibles.length} producto${visibles.length === 1 ? "" : "s"} para «${texto.trim()}».`}
          </p>
        </div>
      )}
      {!cargando && !error && filas.length > 0 && (
        <div className="tabla-inventario" style={{ background: "var(--superficie)", borderRadius: 8 }}>
          {paginacion()}
          <div style={{ overflow: "auto", maxHeight: "calc(100vh - 220px)" }}>
          <Planilla className={oscuro && colores ? "planilla-oscura" : undefined}>
            <thead>
              <tr>
                {columnasTabla.map((columna) => (
                  <th
                    key={columna}
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      textAlign: "left",
                      padding: "10px 12px",
                      borderBottom: "2px solid var(--borde)",
                      background: colores ? "#a9e5e5" : "var(--encabezado)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {columna === "Codigo" ? "Código" : columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody data-tour="planilla">
              {visibles.slice(pagina * tamano, pagina * tamano + 5).map((fila) => (
                <tr
                  key={fila.Codigo}
                  onClick={(event) => {
                    if (bloquearPagina) return;
                    if (event.currentTarget.closest("table")?.dataset.seleccionMovida === "1") return;
                    navigate(`/${encodeURIComponent(fila.Codigo)}`);
                  }}
                  style={{ cursor: bloquearPagina ? "default" : "pointer" }}
                >
                  {columnasTabla.map((columna) => (
                    <td
                      key={columna}
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid var(--borde-suave)",
                        whiteSpace: "nowrap",
                        background: colores ? colorCelda(columna, fila) : undefined,
                      }}
                    >
                      {fila[columna] === "" || fila[columna] == null ? "—" : fila[columna]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tbody>
              {visibles.slice(pagina * tamano + 5, pagina * tamano + tamano).map((fila) => (
                <tr
                  key={fila.Codigo}
                  onClick={(event) => {
                    if (bloquearPagina) return;
                    if (event.currentTarget.closest("table")?.dataset.seleccionMovida === "1") return;
                    navigate(`/${encodeURIComponent(fila.Codigo)}`);
                  }}
                  style={{ cursor: bloquearPagina ? "default" : "pointer" }}
                >
                  {columnasTabla.map((columna) => (
                    <td
                      key={columna}
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid var(--borde-suave)",
                        whiteSpace: "nowrap",
                        background: colores ? colorCelda(columna, fila) : undefined,
                      }}
                    >
                      {fila[columna] === "" || fila[columna] == null ? "—" : fila[columna]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Planilla>
          </div>
          {paginacion()}
        </div>
      )}
      {pedirClave && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 20,
          }}
        >
          <form
            onSubmit={limpiarInventario}
            style={{
              width: "min(420px, 100%)",
              background: "var(--superficie)",
              borderRadius: 8,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <p style={{ margin: 0, fontSize: 16 }}>Ingresa la contraseña para limpiar inventario y comentarios.</p>
            <input
              type="password"
              value={clave}
              autoFocus
              placeholder="Contraseña"
              onChange={(event) => setClave(event.target.value)}
              style={{ padding: "8px 12px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
            />
            {avisoClave && <p style={{ margin: 0, color: "var(--peligro)" }}>{avisoClave}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={limpiando}
                onClick={() => {
                  setPedirClave(false);
                  setClave("");
                  setAvisoClave("");
                }}
                style={{
                  padding: "8px 14px",
                  border: 0,
                  borderRadius: 6,
                  background: "var(--apagado)",
                  color: "var(--apagado-texto)",
                  fontSize: 14,
                  cursor: limpiando ? "default" : "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={limpiando || clave.trim() === ""}
                style={{
                  padding: "8px 14px",
                  border: 0,
                  borderRadius: 6,
                  background: limpiando || clave.trim() === "" ? "var(--apagado)" : "var(--peligro)",
                  color: limpiando || clave.trim() === "" ? "var(--apagado-texto)" : "var(--sobre)",
                  fontSize: 14,
                  cursor: limpiando || clave.trim() === "" ? "default" : "pointer",
                }}
              >
                {limpiando ? "Limpiando..." : "Confirmar"}
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="footer">
        <p>© 2026 Berfre - Práctica 2 - Transformación digital - React - Anibal Alexis Muñoz Reyes - UNAB</p>
    </div>
    </main>
  );
}
