import { useEffect, useState } from "react";
import { useColoresPlanilla } from "./ColoresPlanilla.jsx";
import { useNavigate } from "react-router-dom";
import { useSesion } from "./Acceso.jsx";
import Navbar from "./Navbar.jsx";
import { iniciarRecorrido, recorridoPendiente } from "./Recorrido.jsx";
import Planilla from "./Planilla.jsx";
import Bitacora from "./Bitacora.jsx";
import Ventas from "./Ventas.jsx";
import VistaPrevia from "./admin/VistaPrevia.jsx";
import "./admin.css";
import Interruptor from "./admin/Interruptor.jsx";
import PanelContratistas from "./admin/PanelContratistas.jsx";
import PanelBodega from "./admin/PanelBodega.jsx";
import PanelRegional from "./admin/PanelRegional.jsx";
import PanelInventario from "./admin/PanelInventario.jsx";
import PanelMovimientos from "./admin/PanelMovimientos.jsx";
import PanelReserva from "./admin/PanelReserva.jsx";
import PanelCarga from "./admin/PanelCarga.jsx";
import PanelFormulario from "./admin/PanelFormulario.jsx";
import { useEsMovil } from "./useEsMovil.js";
import { useCargaPlanilla } from "./admin/useCargaPlanilla.js";
import { useDetallado } from "./admin/useDetallado.js";
import { useContratistas } from "./admin/useContratistas.js";
import { usePaneles } from "./admin/usePaneles.js";
import { useRefrescoSse } from "./admin/useRefrescoSse.js";
import { useSalidaSegura } from "./admin/useSalidaSegura.js";
import { useUltimasCargas } from "./admin/useUltimasCargas.js";
import { filtrarYOrdenarPorCodigo, textoUltimaCarga } from "./admin/utilidades.js";
import { obtenerJson, enviarJson, enviarFormulario } from "./api.js";
import FiltrosTabla, { FILTROS_INICIALES } from "./FiltrosTabla.jsx";
import {
  claveUltimaCarga,
  colorStockDetallado,
  filasInventarioVisibles,
  filtrarFilas,
  numerarFilas,
  pasaFiltrosFilaMovimiento,
  POSICIONES_MOVIMIENTOS,
  rutaConFiltros,
  rutaExcel,
  rutaExcelInventario,
} from "./reglasPlanilla.js";

const IMAGENES = new Set(["Rombo", "QR", "Foto"]);
const COLUMNAS_EDITABLES_DETALLADO = new Set([11, 13, 14, 15]);

export default function Admin() {
  const navigate = useNavigate();
  const { colores, oscuro } = useColoresPlanilla();
  const clasePlanilla = oscuro && colores ? "planilla-oscura" : undefined;
  const excel = (ruta) => rutaExcel(ruta, colores);
  const excelFiltrado = (ruta) => rutaConFiltros(excel(ruta), filtrosStock);
  const esMovilCarga = useEsMovil();
  const [botonesMinimizados, setBotonesMinimizados] = useState(false);
  const esBotonActivo = (nombre) =>
    (nombre === "Añadir/cargar datos" && (mostrarCarga || mostrarFormulario)) ||
    (nombre === "Bitacora camion" && mostrarBitacora) ||
    (nombre === "Stock en bodega" && mostrarBodega) ||
    (nombre === "Stock regional" && mostrarRegional) ||
    (nombre === "Planilla de inventario" && mostrarInventario) ||
    (nombre === "Movimientos" && mostrarMovimientos) ||
    (nombre === "Stock detallado" && mostrarDetallado) ||
    (nombre === "Revisar stock de reserva" && mostrarReserva) ||
    (nombre === "Editar contratistas" && mostrarContratistas) ||
    (nombre === "Planilla de ventas" && mostrarVentas);
  const { rol } = useSesion();
  const [autorizado, setAutorizado] = useState(false);
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [columnas, setColumnas] = useState([]);
  const [datos, setDatos] = useState({});
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [archivosQr, setArchivosQr] = useState([]);
  const [importando, setImportando] = useState(false);
  const [avisoCarga, setAvisoCarga] = useState("");
  const { ultimasCargas, cargarUltimasCargas } = useUltimasCargas();
  const [modoCarga, setModoCarga] = useState("completa");
  const [columnaCarga, setColumnaCarga] = useState("");
  const [columnasDestino, setColumnasDestino] = useState([]);
  const [agrandarBotones, setAgrandarBotones] = useState(false);
  const { abierto, fijar: fijarPanel, cerrarOtros: cerrarPaneles } = usePaneles();
  const {
    carga: mostrarCarga,
    formulario: mostrarFormulario,
    bodega: mostrarBodega,
    regional: mostrarRegional,
    inventario: mostrarInventario,
    movimientos: mostrarMovimientos,
    detallado: mostrarDetallado,
    reserva: mostrarReserva,
    contratistas: mostrarContratistas,
    bitacora: mostrarBitacora,
    ventas: mostrarVentas,
  } = abierto;
  const { tabla: bodega, cargando: cargandoBodega, aviso: avisoBodega, recargar: recargarBodega } =
    useCargaPlanilla("/api/bodega", "No se pudo leer el stock.");
  const { tabla: regional, cargando: cargandoRegional, aviso: avisoRegional, recargar: recargarRegional } =
    useCargaPlanilla("/api/regional", "No se pudo leer el stock regional.");
  const { tabla: inventario, cargando: cargandoInventario, aviso: avisoInventario, recargar: recargarInventario } =
    useCargaPlanilla("/api/inventario", "No se pudo leer el inventario.");
  const [copiarExistencia, setCopiarExistencia] = useState(false);
  const [copiarInventario, setCopiarInventario] = useState(false);
  const { tabla: movimientos, cargando: cargandoMovimientos, aviso: avisoMovimientos, recargar: recargarMovimientos } =
    useCargaPlanilla("/api/movimientos", "No se pudieron leer los movimientos.");
  const excelInventario = (ruta) =>
    rutaConFiltros(rutaExcelInventario(ruta, colores, copiarInventario, copiarExistencia), filtrosStock);
  function alternarExistencia() {
    if (copiarExistencia) {
      setCopiarExistencia(false);
      return;
    }
    const confirmar = window.confirm("¿Quieres poner en la columna Existencia los datos de Libre utilización?");
    if (!confirmar) return;
    setCopiarInventario(false);
    setCopiarExistencia(true);
  }
  function alternarInventario() {
    if (copiarInventario) {
      setCopiarInventario(false);
      return;
    }
    const confirmar = window.confirm("¿Quieres poner en la columna Existencia los datos de la columna Inventario?");
    if (!confirmar) return;
    setCopiarExistencia(false);
    setCopiarInventario(true);
  }
  const { tabla: detallado, setTabla: setDetallado, cargando: cargandoDetallado, aviso: avisoDetallado, recargar: recargarDetallado } =
    useCargaPlanilla("/api/stock-detallado", "No se pudo leer el stock detallado.");
  const [filtrosStock, setFiltrosStock] = useState(FILTROS_INICIALES);
  const [filasMaestro, setFilasMaestro] = useState([]);
  const hayPanelStock = mostrarBodega || mostrarRegional || mostrarInventario || mostrarMovimientos || mostrarDetallado;
  useEffect(() => {
    if (!autorizado || !hayPanelStock) return;
    obtenerJson("/api/tabla")
      .then((data) => setFilasMaestro(data.filas || []))
      .catch(() => {});
  }, [autorizado, hayPanelStock]);
  const filasMaestroFiltradas = filtrarFilas(filasMaestro, filtrosStock);
  const codigosFiltrados = new Set(filasMaestroFiltradas.map((f) => String(f.Codigo)));
  const ordenCodigos = new Map(filasMaestroFiltradas.map((f, i) => [String(f.Codigo), i]));
  const aplicarFiltrosStock = (filas, indiceCodigo, marcados) =>
    filtrarYOrdenarPorCodigo(filas, indiceCodigo, marcados, codigosFiltrados, ordenCodigos);
  const detalladoFiltrado = aplicarFiltrosStock(detallado.filas, 1, detallado.marcados);
  const [verFiltrosStock, setVerFiltrosStock] = useState(true);
  const estiloBotonFiltro = {
    padding: "8px 14px",
    border: 0,
    borderRadius: 6,
    background: "var(--boton)",
    color: "var(--sobre)",
    fontSize: 14,
    cursor: "pointer",
  };
  const crearPanelFiltros = (conOrdenUbicacion) => (
    <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button
          type="button"
          style={estiloBotonFiltro}
          onClick={() => setVerFiltrosStock((v) => !v)}
        >
          {verFiltrosStock ? "Ocultar filtros" : "Mostrar filtros"}
        </button>
        <button
          type="button"
          style={estiloBotonFiltro}
          onClick={() => setFiltrosStock(FILTROS_INICIALES)}
        >
          Limpiar filtros
        </button>
      </div>
      {verFiltrosStock && (
        <FiltrosTabla centrado conOrdenUbicacion={conOrdenUbicacion} filas={filasMaestro} filtros={filtrosStock} onChange={setFiltrosStock} />
      )}
    </div>
  );
  const panelFiltros = crearPanelFiltros(false);
  const panelFiltrosUbicacion = crearPanelFiltros(true);
  const filasInventario = aplicarFiltrosStock(
    filasInventarioVisibles(inventario.filas, copiarInventario, copiarExistencia),
    0
  ).filas;
  // Códigos fuera del maestro no se ocultan solo por eso (si no, al editar parecen borrarse),
  // pero sí respetan bodega / texto / checks del panel de filtros.
  const codigosEnMaestro = new Set(filasMaestro.map((f) => String(f.Codigo)));
  const filasMovimientosFiltradas = movimientos.filas.filter((fila) => {
    const codigo = String(fila[1]);
    if (codigosEnMaestro.has(codigo)) return codigosFiltrados.has(codigo);
    return pasaFiltrosFilaMovimiento(fila, filtrosStock);
  });
  const filasMovimientosVisibles = filasInventarioVisibles(
    filasMovimientosFiltradas,
    copiarInventario,
    copiarExistencia,
    POSICIONES_MOVIMIENTOS
  );
  const filasMovimientos = numerarFilas(
    // Sin orden elegido se conserva el del archivo cargado; con uno elegido manda el de los filtros.
    filtrosStock.orden
      ? [...filasMovimientosVisibles].sort((a, b) => {
          const ordenA = ordenCodigos.get(String(a[1]));
          const ordenB = ordenCodigos.get(String(b[1]));
          if (ordenA == null && ordenB == null) return 0;
          if (ordenA == null) return 1;
          if (ordenB == null) return -1;
          return ordenA - ordenB;
        })
      : filasMovimientosVisibles
  );
  const {
    contratistas,
    setContratistas,
    cargando: cargandoContratistas,
    guardando: guardandoContratistas,
    aviso: avisoContratistas,
    setAviso: setAvisoContratistas,
    listaContratistas,
    confirmando: confirmarContratistas,
    setConfirmando: setConfirmarContratistas,
    cargarNombres: cargarNombresContratistas,
    abrir: abrirContratistas,
    guardarConfirmado: guardarContratistasHook,
    refrescar: refrescarContratistas,
    hayCambios: contratistasCambiaron,
    descartar: descartarContratistas,
  } = useContratistas();
  const [bitacoraSinGuardar, setBitacoraSinGuardar] = useState(false);
  const [ventaPendiente, setVentaPendiente] = useState(false);
  const [ventaKey, setVentaKey] = useState(0);
  const [cargaKey, setCargaKey] = useState(0);

  function aplicarColumnas(data) {
    const lista = (data.columnas || []).filter((columna) => !IMAGENES.has(columna));
    setColumnas(lista);
    const destino = (data.columnas || []).filter(
      (columna) => !["Codigo", "Inventario", "Comentario"].includes(columna)
    );
    setColumnasDestino(destino);
    setColumnaCarga((actual) => (destino.includes(actual) ? actual : destino[0] || ""));
    setDatos((actual) => {
      const siguientes = {};
      lista.forEach((columna) => {
        siguientes[columna] = actual[columna] ?? "";
      });
      return siguientes;
    });
  }

  function guardarContratistasConfirmado() {
    guardarContratistasHook(clave);
  }

  function refrescarVistas(silencioso = false) {
    obtenerJson("/api/tabla")
      .then(aplicarColumnas)
      .catch(() => setAviso("No se pudo cargar la tabla."));
    if (mostrarBodega) recargarBodega(silencioso);
    if (mostrarRegional) recargarRegional(silencioso);
    if (mostrarInventario) recargarInventario(silencioso);
    if (mostrarMovimientos) recargarMovimientos(silencioso);
    if (mostrarDetallado) recargarDetallado(silencioso);
    if (mostrarContratistas || mostrarVentas) refrescarContratistas(mostrarContratistas);
  }

  const { suspender: suspenderRefresco, reanudar: reanudarRefresco } = useRefrescoSse(() => refrescarVistas(true));
  const {
    errorDetallado,
    setErrorDetallado,
    actualizarCeldaDetallado,
    guardarCeldaDetallado,
    pegarColumnaDetallado,
    limpiarColumnaDetallado,
  } = useDetallado({ clave, detallado, setDetallado, codigosFiltrados, ordenCodigos, suspenderRefresco, reanudarRefresco });

  const formularioSinGuardar =
    mostrarFormulario && columnas.some((columna) => String(datos[columna] ?? "").trim() !== "");
  const contratistasSinGuardar =
    mostrarContratistas && contratistasCambiaron();
  const ventaSinGuardar = mostrarVentas && ventaPendiente;
  const cargaSinGuardar = mostrarCarga && Boolean(archivo);
  const hayCambiosSinGuardar =
    formularioSinGuardar || contratistasSinGuardar || ventaSinGuardar || cargaSinGuardar || (mostrarBitacora && bitacoraSinGuardar);
  function descartarCambios() {
    if (formularioSinGuardar) {
      setDatos((actual) => {
        const siguientes = {};
        Object.keys(actual).forEach((columna) => {
          siguientes[columna] = "";
        });
        return siguientes;
      });
    }
    if (contratistasSinGuardar) descartarContratistas();
    if (cargaSinGuardar) {
      setArchivo(null);
      setCargaKey((actual) => actual + 1);
    }
    if (ventaSinGuardar) {
      setVentaPendiente(false);
      setVentaKey((actual) => actual + 1);
    }
  }

  const { mostrarAviso, permitirSalida, intentarSalir, seguirAqui, salirSinGuardar } = useSalidaSegura({
    importando,
    hayCambios: hayCambiosSinGuardar,
    descartar: descartarCambios,
  });

  useEffect(() => {
    if (rol !== "admin") return;
    obtenerJson("/api/acceso")
      .then((data) => {
        setClave(data.clave);
        setAutorizado(true);
      })
      .catch(() => {});
  }, [rol]);

  useEffect(() => {
    if (!autorizado) return;
    obtenerJson("/api/tabla")
      .then(aplicarColumnas)
      .catch(() => setAviso("No se pudo cargar la tabla."));
    cargarUltimasCargas();
    if (recorridoPendiente("admin")) iniciarRecorrido("admin");
  }, [autorizado]);

  function enviarCarga(event) {
    event.preventDefault();
    if (modoCarga === "qr" || modoCarga === "rombo" || modoCarga === "foto") {
      const prefijo = modoCarga;
      const campoImagen = { qr: "QR", rombo: "Rombo", foto: "Foto" }[modoCarga];
      const maxBytes = 100 * 1024;
      const patron = new RegExp(`^${prefijo}_(.+)\\.(png|jpe?g)$`, "i");
      const coincidentes = archivosQr
        .map((f) => ({ f, m: patron.exec(f.name) }))
        .filter((x) => x.m);
      const grandes = coincidentes.filter((x) => x.f.size > maxBytes);
      const validos = coincidentes.filter((x) => x.f.size <= maxBytes);
      if (!validos.length) {
        setAvisoCarga(
          coincidentes.length
            ? "Todas las imágenes superan los 100 KB."
            : `La carpeta no tiene imágenes con formato ${prefijo}_{codigo}.png o .jpg.`
        );
        return;
      }
      const omitidasTxt = grandes.length ? ` (${grandes.length} se omiten por superar 100 KB)` : "";
      if (!window.confirm(`¿Subir ${validos.length} imágenes de ${campoImagen} a sus materiales?${omitidasTxt}`)) return;
      const formulario = event.target;
      setAvisoCarga("");
      setImportando(true);
      (async () => {
        let ok = 0;
        const fallidos = [];
        for (let i = 0; i < validos.length; i++) {
          const { f, m } = validos[i];
          setAvisoCarga(`Subiendo ${i + 1} de ${validos.length}...`);
          try {
            const cuerpo = new FormData();
            cuerpo.append("clave", clave);
            cuerpo.append("campo", campoImagen);
            cuerpo.append("archivo", f);
            await enviarFormulario(`/api/material/${encodeURIComponent(m[1])}/imagen`, cuerpo);
            ok++;
          } catch {
            fallidos.push(m[1]);
          }
        }
        setArchivosQr([]);
        formulario.reset();
        const detalle =
          (fallidos.length
            ? `, ${fallidos.length} fallidos (${fallidos.slice(0, 10).join(", ")}${fallidos.length > 10 ? "..." : ""})`
            : "") + (grandes.length ? `, ${grandes.length} omitidos por superar 100 KB` : "");
        setAvisoCarga(`Listo: ${ok} imágenes de ${campoImagen} subidas${detalle}.`);
        refrescarVistas();
      })().finally(() => setImportando(false));
      return;
    }
    if (!archivo) {
      setAvisoCarga("Elige un archivo .xlsx.");
      return;
    }
    if (modoCarga === "dos-columnas" && !columnaCarga) {
      setAvisoCarga("Elige la columna que va a llenar la planilla.");
      return;
    }
    const secciones = {
      completa: "Planilla completa",
      sap: "Planilla EXPORT SAP",
      ubicaciones: "Planilla de ubicaciones",
      precios: "Planilla de precios",
      "dos-columnas": columnaCarga
        ? `Planilla de 2 columnas (columna ${columnaCarga})`
        : "Planilla de 2 columnas",
      reservas: "Añadir reservas",
      movimientos: "Movimientos",
    };
    const seccion = secciones[modoCarga] || modoCarga;
    const confirmar = window.confirm(
      `¿Confirmas la carga del archivo "${archivo.name}" en la sección ${seccion}?`
    );
    if (!confirmar) return;
    setAvisoCarga("");
    setImportando(true);
    const cuerpo = new FormData();
    cuerpo.append("clave", clave);
    cuerpo.append("modo", modoCarga);
    if (modoCarga === "dos-columnas") cuerpo.append("columna", columnaCarga);
    cuerpo.append("archivo", archivo);
    enviarFormulario("/api/tabla/excel", cuerpo, "No se pudo importar.")
      .then((data) => {
        setArchivo(null);
        event.target.reset();
        const omitidos = data.omitidos ? `, ${data.omitidos} omitidos` : "";
        setAvisoCarga(
          modoCarga === "movimientos"
            ? `Listo: ${data.agregados} códigos cargados${omitidos}.`
            : `Listo: ${data.agregados} nuevos, ${data.actualizados} actualizados${omitidos}.`
        );
        cargarUltimasCargas();
        refrescarVistas();
      })
      .catch((err) => setAvisoCarga(err.message))
      .finally(() => setImportando(false));
  }

  function enviarAlta(event) {
    event.preventDefault();
    setAviso("");
    setGuardando(true);
    enviarJson("/api/material", { clave, datos }, "No se pudo agregar.")
      .then((data) => {
        permitirSalida.current = true;
        navigate(`/${encodeURIComponent(data.fila.Codigo)}`);
      })
      .catch((err) => setAviso(err.message))
      .finally(() => setGuardando(false));
  }

  return (
    <main
      className="admin-pagina"
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        margin: 0,
        padding: 16,
        fontFamily: "Segoe UI, sans-serif",
        background: "var(--fondo)",
        color: "var(--texto)",
      }}
    >
      <Navbar />
      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "0 0 16px" }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Agregar material</h1>
        {autorizado && (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", userSelect: "none" }}>
            Agrandar
            <span style={{ position: "relative", width: 42, height: 24, flex: "0 0 auto" }}>
              <input
                type="checkbox"
                checked={agrandarBotones}
                onChange={(event) => setAgrandarBotones(event.target.checked)}
                aria-label="Agrandar"
                style={{ position: "absolute", inset: 0, margin: 0, opacity: 0, cursor: "pointer", zIndex: 1 }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 999,
                  background: agrandarBotones ? "var(--acento)" : "var(--borde)",
                  transition: "background .15s",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: agrandarBotones ? 21 : 3,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left .15s",
                  }}
                />
              </span>
            </span>
          </label>
        )}
      </div>
      {!autorizado && (
        <form
          data-tour="admin-clave"
          onSubmit={(event) => {
            event.preventDefault();
            setAviso("");
            enviarJson("/api/acceso", { clave }, "Contraseña incorrecta.")
              .then(() => setAutorizado(true))
              .catch((err) => setAviso(err.message));
          }}
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          <div style={{ position: "relative" }}>
            <input
              type={verClave ? "text" : "password"}
              value={clave}
              autoFocus
              placeholder="Contraseña"
              onChange={(event) => setClave(event.target.value)}
              style={{ padding: "8px 36px 8px 12px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
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
          <button
            type="submit"
            style={{
              padding: "8px 14px",
              border: 0,
              borderRadius: 6,
              background: "var(--acento)",
              color: "var(--sobre)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Entrar
          </button>
          {aviso && <p style={{ margin: 0 }}>{aviso}</p>}
        </form>
      )}
      {autorizado && esMovilCarga && (
        <button
          type="button"
          onClick={() => setBotonesMinimizados((v) => !v)}
          style={{
            width: "100%",
            marginBottom: 8,
            padding: "8px",
            border: "1px solid var(--borde)",
            borderRadius: 6,
            background: "var(--superficie)",
            color: "var(--texto)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {botonesMinimizados ? "▼ Mostrar todos los botones" : "▲ Minimizar botones"}
        </button>
      )}
      {autorizado && (
        <div
          style={{
            display: "flex",
            flexWrap: agrandarBotones || esMovilCarga ? "wrap" : "nowrap",
            gap: esMovilCarga ? 8 : agrandarBotones ? 10 : 6,
            marginBottom: 16,
            alignItems: "stretch",
          }}
        >
          {[
            "Añadir/cargar datos",
            "Revisar stock de reserva",
            "Stock en bodega",
            "Stock regional",
            "Stock detallado",
            "Planilla de inventario",
            "Movimientos",
            "Bitacora camion",
            "Planilla de ventas",
            "Editar contratistas",
          ].map((nombre, indice, lista) => {
            const activo = esBotonActivo(nombre);
            if (esMovilCarga && botonesMinimizados) {
              const filaActiva = lista.findIndex(esBotonActivo);
              if (filaActiva < 0 || Math.floor(indice / 2) !== Math.floor(filaActiva / 2)) return null;
            }
            return (
              <button
                key={nombre}
                data-tour={nombre}
                type="button"
                disabled={importando}
                onClick={() => {
                  if (importando) return;
                  const cambiar = () => {
                  if (nombre === "Bitacora camion") {
                    const abrir = !mostrarBitacora;
                    if (abrir) cerrarPaneles(["bitacora"]);
                    else setBitacoraSinGuardar(false);
                    fijarPanel("bitacora", abrir);
                  }
                  if (nombre === "Añadir/cargar datos") {
                    const abrir = !(mostrarCarga && mostrarFormulario);
                    if (abrir) cerrarPaneles(["carga", "formulario"]);
                    fijarPanel("carga", abrir);
                    fijarPanel("formulario", abrir);
                  }
                  if (nombre === "Stock en bodega") {
                    const abrir = !mostrarBodega;
                    if (abrir) {
                      cerrarPaneles(["bodega"]);
                      recargarBodega();
                    }
                    fijarPanel("bodega", abrir);
                  }
                  if (nombre === "Stock regional") {
                    const abrir = !mostrarRegional;
                    if (abrir) {
                      cerrarPaneles(["regional"]);
                      recargarRegional();
                    }
                    fijarPanel("regional", abrir);
                  }
                  if (nombre === "Planilla de inventario") {
                    const abrir = !mostrarInventario;
                    if (abrir) {
                      cerrarPaneles(["inventario"]);
                      recargarInventario();
                    }
                    fijarPanel("inventario", abrir);
                  }
                  if (nombre === "Movimientos") {
                    const abrir = !mostrarMovimientos;
                    if (abrir) {
                      cerrarPaneles(["movimientos"]);
                      recargarMovimientos();
                    }
                    fijarPanel("movimientos", abrir);
                  }
                  if (nombre === "Stock detallado") {
                    const abrir = !mostrarDetallado;
                    if (abrir) {
                      cerrarPaneles(["detallado"]);
                      setErrorDetallado("");
                      recargarDetallado();
                    }
                    fijarPanel("detallado", abrir);
                  }
                  if (nombre === "Revisar stock de reserva") {
                    const abrir = !mostrarReserva;
                    if (abrir) cerrarPaneles(["reserva"]);
                    fijarPanel("reserva", abrir);
                  }
                  if (nombre === "Planilla de ventas") {
                    const abrir = !mostrarVentas;
                    if (abrir) {
                      cerrarPaneles(["ventas"]);
                      cargarNombresContratistas().catch(() => {});
                    }
                    fijarPanel("ventas", abrir);
                  }
                  if (nombre === "Editar contratistas") {
                    const abrir = !mostrarContratistas;
                    if (abrir) {
                      cerrarPaneles(["contratistas"]);
                      abrirContratistas();
                    }
                    fijarPanel("contratistas", abrir);
                  }
                  };
                  intentarSalir(cambiar);
                }}
                style={{
                  boxSizing: "border-box",
                  flex: esMovilCarga ? "1 1 calc((100% - 8px) / 2)" : agrandarBotones ? "1 1 calc((100% - 40px) / 5)" : "1 1 0",
                  maxWidth: esMovilCarga ? "calc((100% - 8px) / 2)" : agrandarBotones ? "calc((100% - 40px) / 5)" : undefined,
                  minWidth: esMovilCarga ? 0 : agrandarBotones ? 140 : 0,
                  padding: esMovilCarga ? "12px 8px" : agrandarBotones ? "14px 12px" : "6px 4px",
                  border: activo ? "1px solid var(--acento)" : "1px solid var(--borde)",
                  borderRadius: 6,
                  background: activo ? "var(--acento)" : "var(--superficie)",
                  color: activo ? "var(--sobre)" : "var(--texto)",
                  fontSize: agrandarBotones ? 15 : 12,
                  lineHeight: 1.25,
                  textAlign: "center",
                  whiteSpace: "normal",
                  cursor: importando ? "default" : "pointer",
                  opacity: importando && !activo ? 0.55 : 1,
                }}
              >
                {nombre === "Bitacora camion" ? "Bitácora camión" : nombre}
              </button>
            );
          })}
        </div>
      )}
      {autorizado && importando && (
        <p style={{ margin: "0 0 16px", fontSize: 14 }}>
          Importación en curso. Espera a que termine para cambiar de función.
        </p>
      )}
      {autorizado && mostrarCarga && (
        <PanelCarga
          alEnviar={enviarCarga}
          cargaKey={cargaKey}
          modoCarga={modoCarga}
          setModoCarga={setModoCarga}
          columnaCarga={columnaCarga}
          setColumnaCarga={setColumnaCarga}
          columnasDestino={columnasDestino}
          esMovilCarga={esMovilCarga}
          setArchivosQr={setArchivosQr}
          setArchivo={setArchivo}
          importando={importando}
          textoUltima={textoUltimaCarga(ultimasCargas[claveUltimaCarga(modoCarga, columnaCarga)])}
          avisoCarga={avisoCarga}
        />
      )}
      {autorizado && mostrarBitacora && (
        <Bitacora clave={clave} colores={colores} alPendiente={setBitacoraSinGuardar} />
      )}
      {autorizado && mostrarBodega && (
        <PanelBodega
          tabla={bodega}
          filas={aplicarFiltrosStock(bodega.filas, 0).filas}
          cargando={cargandoBodega}
          aviso={avisoBodega}
          hrefExcel={excelFiltrado("/api/bodega/excel")}
          filtros={panelFiltros}
          colores={colores}
          clasePlanilla={clasePlanilla}
        />
      )}
      {autorizado && mostrarRegional && (
        <PanelRegional
          tabla={regional}
          filas={aplicarFiltrosStock(regional.filas, 0).filas}
          cargando={cargandoRegional}
          aviso={avisoRegional}
          hrefExcel={excelFiltrado("/api/regional/excel")}
          filtros={panelFiltros}
          colores={colores}
          clasePlanilla={clasePlanilla}
        />
      )}
      {autorizado && mostrarInventario && (
        <PanelInventario
          tabla={inventario}
          filas={filasInventario}
          cargando={cargandoInventario}
          aviso={avisoInventario}
          hrefExcel={excelInventario("/api/inventario/excel")}
          filtros={panelFiltrosUbicacion}
          colores={colores}
          clasePlanilla={clasePlanilla}
          copiarExistencia={copiarExistencia}
          copiarInventario={copiarInventario}
          alternarExistencia={alternarExistencia}
          alternarInventario={alternarInventario}
        />
      )}
      {autorizado && mostrarMovimientos && (
        <PanelMovimientos
          clave={clave}
          tabla={movimientos}
          filas={filasMovimientos}
          cargando={cargandoMovimientos}
          aviso={avisoMovimientos}
          recargar={recargarMovimientos}
          hrefExcel={excelInventario("/api/movimientos/excel")}
          filtros={panelFiltrosUbicacion}
          colores={colores}
          clasePlanilla={clasePlanilla}
          copiarExistencia={copiarExistencia}
          copiarInventario={copiarInventario}
          alternarExistencia={alternarExistencia}
          alternarInventario={alternarInventario}
        />
      )}
      {autorizado && mostrarDetallado && (
        <section
          style={{
            background: "var(--superficie)",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Stock detallado</h2>
            <a
              href={excelFiltrado("/api/stock-detallado/excel")}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                background: "var(--boton)",
                color: "var(--sobre)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Descargar planilla
            </a>
          </div>
          {panelFiltrosUbicacion}
          {cargandoDetallado && <p style={{ margin: 0 }}>Cargando stock...</p>}
          {avisoDetallado && <p style={{ margin: 0 }}>{avisoDetallado}</p>}
          {errorDetallado && <p style={{ margin: "0 0 8px", color: "var(--peligro, #b00020)" }}>{errorDetallado}</p>}
          {!cargandoDetallado && !avisoDetallado && (
            <>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 10,
                  alignItems: "center",
                }}
              >
                {[...COLUMNAS_EDITABLES_DETALLADO].sort((a, b) => a - b).map((indiceColumna) => {
                  const columna = detallado.columnas[indiceColumna];
                  if (!columna) return null;
                  return (
                    <button
                      key={columna}
                      type="button"
                      onClick={() => limpiarColumnaDetallado(columna, indiceColumna)}
                      style={{
                        padding: "6px 12px",
                        border: 0,
                        borderRadius: 4,
                        background: "#c62828",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      limpiar {columna}
                    </button>
                  );
                })}
                <span style={{ fontSize: 13, color: "var(--texto-suave, #666)" }}>
                  En una celda editable puedes pegar una columna de Excel para rellenar hacia abajo.
                </span>
              </div>
              <VistaPrevia
                filas={detalladoFiltrado.filas}
                columnas={detallado.columnas.length}
                className={clasePlanilla}
                vacio="No hay stock detallado cargado."
                renderFila={(fila, indice) => (
                  <tr key={`${fila[1]}-${indice}`}>
                    {fila.map((valor, columna) => {
                      const editable = COLUMNAS_EDITABLES_DETALLADO.has(columna);
                      const fondo = colorStockDetallado(columna, valor, detalladoFiltrado.marcados?.[indice], oscuro, fila);
                      // celda-color en oscuro fuerza texto #111; solo aplica si el fondo no es la superficie oscura.
                      const usaColorCelda = Boolean(colores && fondo && fondo !== "var(--superficie)");
                      const nombreColumna = detallado.columnas[columna];
                      return (
                        <td
                          key={columna}
                          className={usaColorCelda ? "celda-color" : undefined}
                          style={{
                            padding: editable ? "4px 6px" : "8px 10px",
                            border: "1px solid var(--borde-suave)",
                            background: colores ? fondo : "var(--superficie)",
                            fontWeight: columna === 10 ? 700 : 400,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {editable ? (
                            <input
                              aria-label={`${nombreColumna} ${fila[1]}`}
                              value={valor == null ? "" : String(valor)}
                              onChange={(event) => actualizarCeldaDetallado(fila[1], columna, event.target.value)}
                              onFocus={(event) => {
                                event.target.dataset.original = event.target.value;
                              }}
                              onPaste={(event) => {
                                const aplicado = pegarColumnaDetallado(
                                  indice,
                                  columna,
                                  nombreColumna,
                                  event.clipboardData.getData("text")
                                );
                                if (aplicado == null) return;
                                event.preventDefault();
                                if (typeof aplicado === "string") event.target.dataset.original = aplicado;
                              }}
                              onBlur={(event) =>
                                guardarCeldaDetallado(
                                  fila[1],
                                  nombreColumna,
                                  columna,
                                  event.target.value,
                                  event.target.dataset.original ?? ""
                                )
                              }
                              style={{
                                width: "100%",
                                minWidth: 72,
                                boxSizing: "border-box",
                                padding: "4px 6px",
                                border: "1px solid var(--borde)",
                                borderRadius: 4,
                                background: "var(--campo)",
                                color: "var(--texto)",
                                font: "inherit",
                              }}
                            />
                          ) : (
                            valor === "" || valor == null ? "" : String(valor)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )}
              >
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
                            background: colores ? "#a9e5e5" : "var(--superficie)",
                            border: "1px solid var(--borde)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {columna}
                        </th>
                      ))}
                    </tr>
                  </thead>
              </VistaPrevia>
            </>
          )}
        </section>
      )}
      {autorizado && <PanelReserva visible={mostrarReserva} colores={colores} clasePlanilla={clasePlanilla} />}
      {autorizado && mostrarVentas && (
        <Ventas key={ventaKey} colores={colores} listaContratistas={listaContratistas} onSinGuardar={setVentaPendiente} />
      )}
      {autorizado && mostrarContratistas && (
        <PanelContratistas
          contratistas={contratistas}
          setContratistas={setContratistas}
          cargando={cargandoContratistas}
          guardando={guardandoContratistas}
          aviso={avisoContratistas}
          setAviso={setAvisoContratistas}
          alPedirConfirmacion={() => setConfirmarContratistas(true)}
          colores={colores}
          clasePlanilla={clasePlanilla}
        />
      )}
      {autorizado && mostrarFormulario && (
        <PanelFormulario
          alEnviar={enviarAlta}
          columnas={columnas}
          datos={datos}
          setDatos={setDatos}
          guardando={guardando}
          aviso={aviso}
        />
      )}
      {confirmarContratistas && (
        <div
          role="dialog"
          aria-label="Confirmar cambios en contratistas"
          style={{ position: "fixed", inset: 0, background: "rgba(17, 24, 39, 0.55)", display: "grid", placeItems: "center", padding: 24, zIndex: 80 }}
        >
          <div style={{ background: "var(--superficie)", borderRadius: 8, padding: 20, maxWidth: 420 }}>
            <p style={{ margin: "0 0 8px", fontWeight: 700 }}>¿Guardar los cambios en contratistas?</p>
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              Se reemplazará la lista de contratistas que se puede elegir al cargar ventas. ¿Estás seguro de realizar el cambio?
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <button
                type="button"
                onClick={guardarContratistasConfirmado}
                style={{ width: "100%", padding: "10px 14px", border: 0, borderRadius: 6, background: "var(--acento)", color: "var(--sobre)", fontSize: 14, cursor: "pointer" }}
              >
                Sí, guardar cambios
              </button>
              <button
                type="button"
                onClick={() => setConfirmarContratistas(false)}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--borde)", borderRadius: 6, background: "var(--superficie)", fontSize: 14, cursor: "pointer" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {mostrarAviso && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.55)",
            display: "grid",
            placeItems: "center",
            padding: 24,
            zIndex: 80,
          }}
        >
          <div style={{ background: "var(--superficie)", borderRadius: 8, padding: 20, maxWidth: 420 }}>
            <p style={{ margin: "0 0 8px", fontWeight: 700 }}>
              {importando ? "Importación en curso" : "Hay cambios sin guardar"}
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              {importando
                ? "Espera a que termine la carga. Si sales ahora se interrumpe la importación."
                : "Si sales de esta página se pierden los datos que todavía no guardaste."}
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <button
                type="button"
                onClick={seguirAqui}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: 0,
                  borderRadius: 6,
                  background: "var(--acento)",
                  color: "var(--sobre)",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Seguir en esta página
              </button>
              {!importando && (
              <button
                type="button"
                onClick={salirSinGuardar}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid var(--borde)",
                  borderRadius: 6,
                  background: "var(--superficie)",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Salir sin guardar
              </button>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="footer">
        <p>© 2026 Berfre - Práctica 2 - Transformación digital - React - Anibal Alexis Muñoz Reyes - UNAB</p>
    </div>
    </main>
  );
}
