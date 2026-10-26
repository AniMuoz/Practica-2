import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useColoresPlanilla } from "./ColoresPlanilla.jsx";
import Navbar from "./Navbar.jsx";
import Planilla from "./Planilla.jsx";
import { iniciarRecorrido, recorridoPendiente } from "./Recorrido.jsx";
import { sonarActualizacion } from "./sonido.js";
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

function nombreInventarioPorDefecto(fecha = new Date()) {
  const dd = String(fecha.getDate()).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  return `INVENTARIO ${dd}-${mm}-${fecha.getFullYear()}`;
}

// Como useState, pero guarda el valor en sessionStorage para que los filtros
// sigan aplicados al volver desde el detalle de un material o desde admin.
function useFiltroPersistente(clave, inicial) {
  const llave = `filtro-tabla:${clave}`;
  const [valor, setValor] = useState(() => {
    try {
      const guardado = sessionStorage.getItem(llave);
      return guardado === null ? inicial : JSON.parse(guardado);
    } catch {
      return inicial;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(llave, JSON.stringify(valor));
    } catch {
      // almacenamiento no disponible: se ignora
    }
  }, [llave, valor]);
  return [valor, setValor];
}

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
  const [orden, setOrden] = useFiltroPersistente("orden", "codigo-asc");
  const [bodega, setBodega] = useFiltroPersistente("bodega", "");
  const [subUbicacion, setSubUbicacion] = useFiltroPersistente("subUbicacion", "");
  const [caracteristica, setCaracteristica] = useFiltroPersistente("caracteristica", "");
  const [stockMinimo, setStockMinimo] = useFiltroPersistente("stockMinimo", "");
  const [soloConPrecio, setSoloConPrecio] = useFiltroPersistente("soloConPrecio", false);
  const [soloConUbicacion, setSoloConUbicacion] = useFiltroPersistente("soloConUbicacion", false);
  const [soloStockCritico, setSoloStockCritico] = useFiltroPersistente("soloStockCritico", false);
  const [soloStockCero, setSoloStockCero] = useFiltroPersistente("soloStockCero", false);
  const [soloInventarioOComentario, setSoloInventarioOComentario] = useFiltroPersistente("soloInventarioOComentario", false);
  const [soloMarcados, setSoloMarcados] = useFiltroPersistente("soloMarcados", false);
  const [soloConRombo, setSoloConRombo] = useFiltroPersistente("soloConRombo", false);
  const [ignorarNulo, setIgnorarNulo] = useFiltroPersistente("ignorarNulo", true);
  const [bloquearPagina, setBloquearPagina] = useState(false);
  const [limpiando, setLimpiando] = useState(false);
  const [urlDescarga, setUrlDescarga] = useState("");
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [nombrePersonalizado, setNombrePersonalizado] = useState(false);
  const [pedirClave, setPedirClave] = useState(false);
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [avisoClave, setAvisoClave] = useState("");
  const [enDescanso, setEnDescanso] = useState(false);
  const tamano = 100;
  const etagTabla = useRef("");

  function estiloBoton(habilitado, fondo = "var(--boton)", padding = "8px 14px") {
    return {
      padding,
      border: 0,
      borderRadius: 6,
      background: habilitado ? fondo : "var(--apagado)",
      color: habilitado ? "var(--sobre)" : "var(--apagado-texto)",
      fontSize: 14,
      cursor: habilitado ? "pointer" : "default",
    };
  }

  function colorCelda(columna, fila) {
    return colorDeCelda(columna, fila, oscuro);
  }

  const bodegas = useMemo(() => bodegasDe(filas), [filas]);

  const subUbicaciones = useMemo(() => subUbicacionesDe(filas, bodega), [filas, bodega]);

  useEffect(() => {
    if (filas.length > 0 && subUbicacion && !subUbicaciones.includes(subUbicacion)) setSubUbicacion("");
  }, [filas, subUbicacion, subUbicaciones]);

  const caracteristicas = useMemo(
    () => [...new Set(filas.map((fila) => String(fila.Caracteristica ?? "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "es")),
    [filas]
  );

  const visibles = useMemo(
    () => filtrarFilas(filas, {
      orden,
      bodega,
      subUbicacion,
      caracteristica,
      stockMinimo,
      soloConPrecio,
      soloConUbicacion,
      soloStockCritico,
      soloStockCero,
      soloInventarioOComentario,
      soloMarcados,
      soloConRombo,
      ignorarNulo,
      texto,
    }),
    [filas, orden, bodega, subUbicacion, caracteristica, stockMinimo, soloConPrecio, soloConUbicacion, soloStockCritico, soloStockCero, soloInventarioOComentario, soloMarcados, soloConRombo, ignorarNulo, texto]
  );

  useEffect(() => {
    setPagina(0);
  }, [orden, bodega, subUbicacion, caracteristica, stockMinimo, soloConPrecio, soloConUbicacion, soloStockCritico, soloStockCero, soloInventarioOComentario, soloMarcados, soloConRombo, ignorarNulo, texto]);

  function cargarTabla() {
    const headers = {};
    if (etagTabla.current) headers["If-None-Match"] = etagTabla.current;
    return fetch("/api/tabla", { cache: "no-store", headers })
      .then((res) => {
        if (res.status === 304) return null;
        if (!res.ok) throw new Error("No se pudo leer la API");
        const etag = res.headers.get("etag");
        if (etag) etagTabla.current = etag;
        return res.json();
      })
      .then((data) => {
        if (!data) return false;
        setColumnas(data.columnas || []);
        setFilas(data.filas || []);
        return true;
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
    const INTERVALO = 60000;
    const INACTIVIDAD = 120000;
    const fuente = new EventSource("/api/eventos");
    let sondeo = null;
    let inactividad = null;
    const iniciarSondeo = () => {
      if (sondeo || document.visibilityState !== "visible") return;
      sondeo = setInterval(() => {
        if (document.visibilityState === "visible") {
          // El sondeo es el respaldo si el SSE queda en búfer: avisa si hubo cambios.
          cargarTabla().then((cambio) => cambio && sonarActualizacion()).catch(() => {});
        }
      }, INTERVALO);
    };
    const detenerSondeo = () => {
      if (!sondeo) return;
      clearInterval(sondeo);
      sondeo = null;
    };
    const programarPausa = () => {
      clearTimeout(inactividad);
      inactividad = setTimeout(() => {
        detenerSondeo();
        setEnDescanso(true);
      }, INACTIVIDAD);
    };
    const reanudar = (leerAhora) => {
      programarPausa();
      if (document.visibilityState !== "visible") {
        detenerSondeo();
        return;
      }
      const estabaDetenido = !sondeo;
      iniciarSondeo();
      if (sondeo) setEnDescanso(false);
      if (leerAhora && estabaDetenido) cargarTabla().catch(() => {});
    };
    fuente.onopen = () => {
      cargarTabla().catch(() => {});
    };
    fuente.onerror = () => {};
    // Cloudflare puede almacenar en búfer el SSE sin disparar error:
    // se sondea como respaldo, cada 60 s, y se pausa tras 2 min sin uso.
    reanudar(false);
    const alVolver = () => {
      if (document.visibilityState !== "visible") {
        detenerSondeo();
        return;
      }
      programarPausa();
      iniciarSondeo();
      setEnDescanso(false);
      cargarTabla().catch(() => {});
    };
    const alUsar = () => reanudar(true);
    document.addEventListener("visibilitychange", alVolver);
    document.addEventListener("pointerdown", alUsar);
    document.addEventListener("keydown", alUsar);
    document.addEventListener("scroll", alUsar, true);
    fuente.onmessage = (evento) => {
      let data;
      try {
        data = JSON.parse(evento.data);
      } catch {
        return;
      }
      if (data.tipo === "fila" && data.fila) {
        setFilas((actuales) => aplicarFilaRecibida(actuales, data));
        sonarActualizacion();
        return;
      }
      if (data.tipo === "recarga") {
        cargarTabla().then(sonarActualizacion).catch(() => setError("No se pudo actualizar la tabla."));
      }
    };
    return () => {
      fuente.close();
      detenerSondeo();
      clearTimeout(inactividad);
      document.removeEventListener("visibilitychange", alVolver);
      document.removeEventListener("pointerdown", alUsar);
      document.removeEventListener("keydown", alUsar);
      document.removeEventListener("scroll", alUsar, true);
    };
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
        style={estiloBoton(pagina !== 0, "var(--boton)", "6px 12px")}
      >
        Anterior
      </button>
      <span style={{ fontSize: 14 }}>{rango}</span>
      <button
        type="button"
        disabled={alFinal}
        onClick={() => setPagina((actual) => actual + 1)}
        style={estiloBoton(!alFinal, "var(--boton)", "6px 12px")}
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
              style={estiloBoton(true)}
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
              Bloquear página de material
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
              style={estiloBoton(!(cargando || limpiando), "var(--peligro)")}
            >
              {limpiando ? "Limpiando..." : "Limpiar inventario y comentarios"}
            </button>
            <a
              data-tour="descargar"
              onClick={(e) => {
                e.preventDefault();
                setUrlDescarga(e.currentTarget.getAttribute("href"));
                setNombreArchivo("");
                setNombrePersonalizado(false);
              }}
              href={consultaExcel({
                colores,
                orden,
                bodega,
                subUbicacion,
                stockMinimo,
                soloConPrecio,
                soloConUbicacion,
                soloStockCritico,
                soloStockCero,
                soloInventarioOComentario,
                soloMarcados,
                soloConRombo,
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
                    checked={orden === "codigo-asc"}
                    onChange={() => setOrden("codigo-asc")}
                  />
                  Ordenar códigos de menor a mayor
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
                    checked={orden === "ubicacion-asc"}
                    onChange={() => setOrden("ubicacion-asc")}
                  />
                  Ordenar ubicaciones de menor a mayor
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                  <input
                    type="radio"
                    name="orden"
                    checked={orden === "ubicacion"}
                    onChange={() => setOrden("ubicacion")}
                  />
                  Ordenar ubicaciones de mayor a menor
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
                  Característica
                  <select
                    value={caracteristica}
                    onChange={(event) => setCaracteristica(event.target.value)}
                    style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
                  >
                    <option value="">Todas</option>
                    {caracteristicas.map((valor) => (
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
                    checked={soloStockCero}
                    onChange={(event) => setSoloStockCero(event.target.checked)}
                  />
                  Mostrar solo materiales con stock igual a 0
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
                    checked={soloConRombo}
                    onChange={(event) => setSoloConRombo(event.target.checked)}
                  />
                  Mostrar solo materiales con rombo de peligrosidad
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
                  setCaracteristica("");
                  setStockMinimo("");
                  setSoloConPrecio(false);
                  setSoloConUbicacion(false);
                  setSoloStockCritico(false);
                  setSoloStockCero(false);
                  setSoloInventarioOComentario(false);
                  setSoloMarcados(false);
                  setSoloConRombo(false);
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
          {enDescanso && (
            <p
              style={{
                position: "sticky",
                top: 8,
                zIndex: 2,
                width: "fit-content",
                margin: "8px auto",
                padding: "8px 14px",
                borderRadius: 6,
                background: "var(--acento)",
                color: "var(--sobre)",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Tabla en descanso por no uso
            </p>
          )}
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
      {urlDescarga && (
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
            onSubmit={(event) => {
              event.preventDefault();
              const nombre = nombrePersonalizado ? nombreArchivo.trim().replace(/\.xlsx$/i, "") : "";
              let url = urlDescarga;
              if (nombre) url += `${url.includes("?") ? "&" : "?"}nombre=${encodeURIComponent(nombre)}`;
              setUrlDescarga("");
              window.location.assign(url);
            }}
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
            <h3 style={{ margin: 0, fontSize: 16 }}>Nombre del archivo</h3>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
              <input
                type="radio"
                name="modo-nombre"
                checked={nombrePersonalizado === false}
                onChange={() => setNombrePersonalizado(false)}
              />
              <span>
                {nombreInventarioPorDefecto()} <span style={{ opacity: 0.7 }}>(por defecto)</span>
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
              <input
                type="radio"
                name="modo-nombre"
                checked={nombrePersonalizado}
                onChange={() => setNombrePersonalizado(true)}
              />
              <input
                type="text"
                value={nombreArchivo}
                placeholder="Escribir otro nombre"
                onFocus={() => setNombrePersonalizado(true)}
                onChange={(event) => {
                  setNombreArchivo(event.target.value);
                  setNombrePersonalizado(true);
                }}
                style={{ flex: 1, boxSizing: "border-box", padding: "8px 12px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
              />
              <span style={{ fontSize: 14 }}>.xlsx</span>
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setUrlDescarga("")}
                style={estiloBoton(true, "var(--borde)")}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={nombrePersonalizado && nombreArchivo.trim() === ""}
                style={estiloBoton(!(nombrePersonalizado && nombreArchivo.trim() === ""), "var(--descarga)")}
              >
                Descargar
              </button>
            </div>
          </form>
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
            <div style={{ position: "relative" }}>
              <input
                type={verClave ? "text" : "password"}
                value={clave}
                autoFocus
                placeholder="Contraseña"
                onChange={(event) => setClave(event.target.value)}
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 36px 8px 12px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
              />
              <button
                type="button"
                aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setVerClave((visible) => !visible)}
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: 0,
                  background: "transparent",
                  padding: 4,
                  cursor: "pointer",
                  color: "var(--texto)",
                  display: "flex",
                }}
              >
                {verClave ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6A2 2 0 0 0 13.4 13.4" />
                    <path d="M9.9 5.1A10.8 10.8 0 0 1 12 5c5.5 0 9.5 4.5 10.5 7-.4 1-1.2 2.4-2.4 3.6" />
                    <path d="M6.1 6.1C4.2 7.4 2.8 9.2 1.5 12c1 2.5 5 7 10.5 7 1.6 0 3-.4 4.3-1" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {avisoClave && <p style={{ margin: 0, color: "var(--peligro)" }}>{avisoClave}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={limpiando}
                onClick={() => {
                  setPedirClave(false);
                  setClave("");
                  setVerClave(false);
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
                style={estiloBoton(!(limpiando || clave.trim() === ""), "var(--peligro)")}
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
