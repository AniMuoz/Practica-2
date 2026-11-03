import { useEffect, useState } from "react";
import { useColoresPlanilla } from "../componentes/ColoresPlanilla.jsx";
import { useNavigate } from "react-router-dom";
import { useSesion } from "../componentes/Acceso.jsx";
import Navbar from "../componentes/Navbar.jsx";
import { iniciarRecorrido, recorridoPendiente } from "../componentes/Recorrido.jsx";
import Planilla from "./Planilla.jsx";
import Bitacora from "./Bitacora.jsx";
import Ventas from "./Ventas.jsx";
import VistaPrevia from "./admin/paneles/VistaPrevia.jsx";
import "../estilos/admin.css";
import Interruptor from "./admin/paneles/Interruptor.jsx";
import PanelContratistas from "./admin/paneles/PanelContratistas.jsx";
import PanelBodega from "./admin/paneles/PanelBodega.jsx";
import PanelRegional from "./admin/paneles/PanelRegional.jsx";
import PanelInventario from "./admin/paneles/PanelInventario.jsx";
import PanelMovimientos from "./admin/paneles/PanelMovimientos.jsx";
import PanelReserva from "./admin/paneles/PanelReserva.jsx";
import PanelDetallado from "./admin/paneles/PanelDetallado.jsx";
import PanelCarga from "./admin/paneles/PanelCarga.jsx";
import PanelFormulario from "./admin/paneles/PanelFormulario.jsx";
import { useEsMovil } from "../lib/useEsMovil.js";
import { useCargaPlanilla } from "./admin/hooks/useCargaPlanilla.js";
import { useDetallado } from "./admin/hooks/useDetallado.js";
import { useContratistas } from "./admin/hooks/useContratistas.js";
import { usePaneles } from "./admin/hooks/usePaneles.js";
import { useRefrescoSse } from "./admin/hooks/useRefrescoSse.js";
import { useSalidaSegura } from "./admin/hooks/useSalidaSegura.js";
import { useUltimasCargas } from "./admin/hooks/useUltimasCargas.js";
import { useCargaDatos } from "./admin/hooks/useCargaDatos.js";
import { useFiltrosStock } from "./admin/hooks/useFiltrosStock.jsx";
import { useCopiaExistencia } from "./admin/hooks/useCopiaExistencia.js";
import { textoUltimaCarga } from "./admin/utilidades.js";
import { obtenerJson, enviarJson } from "../lib/api.js";
import FiltrosTabla, { FILTROS_INICIALES } from "../componentes/FiltrosTabla.jsx";
import {
  claveUltimaCarga,
  rutaConFiltros,
  rutaExcel,
  rutaExcelInventario,
} from "../lib/reglasPlanilla.js";

const IMAGENES = new Set(["Rombo", "QR", "Foto"]);

// Paneles que enciende cada boton de la barra (para marcarlo como activo).
const PANELES_BOTON = {
  "Añadir/cargar datos": ["carga", "formulario"],
  "Bitacora camion": ["bitacora"],
  "Stock en bodega": ["bodega"],
  "Stock regional": ["regional"],
  "Planilla de inventario": ["inventario"],
  Movimientos: ["movimientos"],
  "Stock detallado": ["detallado"],
  "Revisar stock de reserva": ["reserva"],
  "Editar contratistas": ["contratistas"],
  "Planilla de ventas": ["ventas"],
};

export default function Admin() {
  const navigate = useNavigate();
  const { colores, oscuro } = useColoresPlanilla();
  const clasePlanilla = oscuro && colores ? "planilla-oscura" : undefined;
  const excel = (ruta) => rutaExcel(ruta, colores);
  const excelFiltrado = (ruta) => rutaConFiltros(excel(ruta), filtrosStock);
  const esMovilCarga = useEsMovil();
  const [botonesMinimizados, setBotonesMinimizados] = useState(false);
  const esBotonActivo = (nombre) => PANELES_BOTON[nombre]?.some((panel) => abierto[panel]) ?? false;
  const { rol } = useSesion();
  const [autorizado, setAutorizado] = useState(false);
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [columnas, setColumnas] = useState([]);
  const [datos, setDatos] = useState({});
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const { ultimasCargas, cargarUltimasCargas } = useUltimasCargas();
  const {
    archivo,
    setArchivo,
    setArchivosQr,
    importando,
    avisoCarga,
    modoCarga,
    setModoCarga,
    columnaCarga,
    setColumnaCarga,
    columnasDestino,
    cargaKey,
    aplicarDestino,
    descartarCarga,
    enviarCarga,
  } = useCargaDatos({ clave, refrescarVistas: () => refrescarVistas(), cargarUltimasCargas });
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
  const { copiarExistencia, copiarInventario, alternarExistencia, alternarInventario } = useCopiaExistencia();
  const { tabla: movimientos, cargando: cargandoMovimientos, aviso: avisoMovimientos, recargar: recargarMovimientos } =
    useCargaPlanilla("/api/movimientos", "No se pudieron leer los movimientos.");
  const excelInventario = (ruta) =>
    rutaConFiltros(rutaExcelInventario(ruta, colores, copiarInventario, copiarExistencia), filtrosStock);
  const { tabla: detallado, setTabla: setDetallado, cargando: cargandoDetallado, aviso: avisoDetallado, recargar: recargarDetallado } =
    useCargaPlanilla("/api/stock-detallado", "No se pudo leer el stock detallado.");
  const hayPanelStock = mostrarBodega || mostrarRegional || mostrarInventario || mostrarMovimientos || mostrarDetallado;
  const {
    filtrosStock,
    panelFiltros,
    panelFiltrosUbicacion,
    codigosFiltrados,
    ordenCodigos,
    aplicarFiltrosStock,
    detalladoFiltrado,
    filasInventario,
    filasMovimientos,
  } = useFiltrosStock({
    activo: autorizado && hayPanelStock,
    detallado,
    inventario,
    movimientos,
    copiarInventario,
    copiarExistencia,
  });
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

  function aplicarColumnas(data) {
    const lista = (data.columnas || []).filter((columna) => !IMAGENES.has(columna));
    setColumnas(lista);
    const destino = (data.columnas || []).filter(
      (columna) => !["Codigo", "Inventario", "Comentario"].includes(columna)
    );
    aplicarDestino(destino);
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
      descartarCarga();
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

  // Abre el panel y cierra los demas (recargando lo que haga falta); si ya estaba abierto, lo cierra.
  function alternarPanel(panel, alAbrir, alCerrar) {
    const abrir = !abierto[panel];
    if (abrir) {
      cerrarPaneles([panel]);
      alAbrir?.();
    } else {
      alCerrar?.();
    }
    fijarPanel(panel, abrir);
  }

  function alternarBoton(nombre) {
    switch (nombre) {
      case "Bitacora camion":
        return alternarPanel("bitacora", null, () => setBitacoraSinGuardar(false));
      case "Añadir/cargar datos": {
        const abrir = !(mostrarCarga && mostrarFormulario);
        if (abrir) cerrarPaneles(["carga", "formulario"]);
        fijarPanel("carga", abrir);
        return fijarPanel("formulario", abrir);
      }
      case "Stock en bodega":
        return alternarPanel("bodega", () => recargarBodega());
      case "Stock regional":
        return alternarPanel("regional", () => recargarRegional());
      case "Planilla de inventario":
        return alternarPanel("inventario", () => recargarInventario());
      case "Movimientos":
        return alternarPanel("movimientos", () => recargarMovimientos());
      case "Stock detallado":
        return alternarPanel("detallado", () => {
          setErrorDetallado("");
          recargarDetallado();
        });
      case "Revisar stock de reserva":
        return alternarPanel("reserva");
      case "Planilla de ventas":
        return alternarPanel("ventas", () => cargarNombresContratistas().catch(() => {}));
      case "Editar contratistas":
        return alternarPanel("contratistas", () => abrirContratistas());
    }
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
                  intentarSalir(() => alternarBoton(nombre));
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
        <PanelDetallado
          tabla={detallado}
          filtrado={detalladoFiltrado}
          cargando={cargandoDetallado}
          aviso={avisoDetallado}
          error={errorDetallado}
          hrefExcel={excelFiltrado("/api/stock-detallado/excel")}
          filtros={panelFiltrosUbicacion}
          colores={colores}
          oscuro={oscuro}
          clasePlanilla={clasePlanilla}
          limpiarColumna={limpiarColumnaDetallado}
          actualizarCelda={actualizarCeldaDetallado}
          guardarCelda={guardarCeldaDetallado}
          pegarColumna={pegarColumnaDetallado}
        />
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
