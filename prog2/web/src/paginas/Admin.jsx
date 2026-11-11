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
import { CuerpoGastos } from "./Gastos.jsx";
import PanelInventario from "./admin/paneles/PanelInventario.jsx";
import PanelMovimientos from "./admin/paneles/PanelMovimientos.jsx";
import PanelReserva from "./admin/paneles/PanelReserva.jsx";
import PanelDetallado from "./admin/paneles/PanelDetallado.jsx";
import FormularioClave from "../componentes/FormularioClave.jsx";
import DialogoConfirmacion from "../componentes/DialogoConfirmacion.jsx";
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
import { useEstadoPersistente } from "../lib/persistencia.js";
import FiltrosTabla, { FILTROS_INICIALES } from "../componentes/FiltrosTabla.jsx";
import {
  claveUltimaCarga,
  rutaConFiltros,
  rutaExcel,
  rutaExcelInventario,
} from "../lib/reglasPlanilla.js";

// Funciones que solo escriben datos: los operadores no las ven.
const BOTONES_SOLO_ADMIN = new Set(["Añadir/cargar datos", "Planilla de ventas"]);

// Secciones que solo ve un admin de la bodega M501; las demas bodegas solo ven y descargan planillas.
const BOTONES_SOLO_M501 = new Set(["Añadir/cargar datos", "Movimientos", "Planilla de ventas", "Editar contratistas", "Bitacora camion"]);

const IMAGENES = new Set(["Rombo", "QR", "Foto"]);

// Paneles que enciende cada boton de la barra (para marcarlo como activo).
const PANELES_BOTON = {
  "Añadir/cargar datos": ["carga", "formulario"],
  "Bitacora camion": ["bitacora"],
  "Stock en bodega": ["bodega"],
  "Planilla de inventario": ["inventario"],
  Movimientos: ["movimientos"],
  Gastos: ["gastos"],
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
  const { rol, bodega: bodegaUsuario } = useSesion();
  const puedeEditar = rol === "admin" && (bodegaUsuario || "M501") === "M501";
  // Admin externo: ve todo como M501 pero no modifica nada (salvo gastos, bitacora, inventario/comentario y QR).
  const esExt = rol === "admin_ext";
  const [autorizado, setAutorizado] = useState(false);
  const [clave, setClave] = useState("");
  const [columnas, setColumnas] = useState([]);
  const [datos, setDatos] = useEstadoPersistente("admin:formulario", {});
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
    gastos: mostrarGastos,
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
  const { tabla: inventario, cargando: cargandoInventario, aviso: avisoInventario, recargar: recargarInventario } =
    useCargaPlanilla("/api/inventario", "No se pudo leer el inventario.");
  const { copiarExistencia, copiarInventario, alternarExistencia, alternarInventario } = useCopiaExistencia();
  const { tabla: movimientos, cargando: cargandoMovimientos, aviso: avisoMovimientos, recargar: recargarMovimientos } =
    useCargaPlanilla("/api/movimientos", "No se pudieron leer los movimientos.");
  const excelInventario = (ruta) =>
    rutaConFiltros(rutaExcelInventario(ruta, colores, copiarInventario, copiarExistencia), filtrosStock);
  const { tabla: detallado, setTabla: setDetallado, cargando: cargandoDetallado, aviso: avisoDetallado, recargar: recargarDetallado } =
    useCargaPlanilla("/api/stock-detallado", "No se pudo leer el stock detallado.");
  const hayPanelStock = mostrarBodega || mostrarInventario || mostrarMovimientos || mostrarDetallado;
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
  } = useContratistas();

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
    if (mostrarInventario) recargarInventario(silencioso);
    if (mostrarMovimientos) recargarMovimientos(silencioso);
    if (mostrarDetallado) recargarDetallado(silencioso);
    if (mostrarContratistas || mostrarVentas) refrescarContratistas(mostrarContratistas);
  }

  const { suspender: suspenderRefresco, reanudar: reanudarRefresco } = useRefrescoSse(() => refrescarVistas(true));
  const {
    errorDetallado,
    setErrorDetallado,
    pendientesDetallado,
    guardandoDetallado,
    actualizarCeldaDetallado,
    pegarColumnaDetallado,
    guardarCambiosDetallado,
    limpiarColumnaDetallado,
  } = useDetallado({ clave, detallado, setDetallado, codigosFiltrados, ordenCodigos, suspenderRefresco, reanudarRefresco });

  // Formulario, contratistas, ventas, bitacora y detallado conservan su borrador en sessionStorage,
  // asi que solo la carga de un archivo (que no se puede persistir) avisa al salir.
  const cargaSinGuardar = mostrarCarga && Boolean(archivo);
  const hayCambiosSinGuardar = cargaSinGuardar;
  function descartarCambios() {
    if (cargaSinGuardar) descartarCarga();
  }

  const { mostrarAviso, permitirSalida, intentarSalir, seguirAqui, salirSinGuardar } = useSalidaSegura({
    importando,
    hayCambios: hayCambiosSinGuardar,
    descartar: descartarCambios,
  });

  useEffect(() => {
    if (rol === "admin_ext") {
      setAutorizado(true);
      return;
    }
    if (rol !== "admin") return;
    obtenerJson("/api/acceso")
      .then(() => {
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
    // Los paneles abiertos se restauran desde sessionStorage: hay que cargar sus datos como al abrirlos a mano.
    if (mostrarBodega) recargarBodega();
    if (mostrarInventario) recargarInventario();
    if (mostrarMovimientos) recargarMovimientos();
    if (mostrarDetallado) recargarDetallado();
    if (mostrarContratistas) abrirContratistas();
    else if (mostrarVentas) cargarNombresContratistas().catch(() => {});
  }, [autorizado]);

  function enviarAlta(event) {
    event.preventDefault();
    setAviso("");
    setGuardando(true);
    enviarJson("/api/material", { clave, datos }, "No se pudo agregar.")
      .then((data) => {
        permitirSalida.current = true;
        setDatos({});
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
        return alternarPanel("bitacora");
      case "Añadir/cargar datos": {
        const abrir = !(mostrarCarga && mostrarFormulario);
        if (abrir) cerrarPaneles(["carga", "formulario"]);
        fijarPanel("carga", abrir);
        return fijarPanel("formulario", abrir);
      }
      case "Stock en bodega":
        return alternarPanel("bodega", () => recargarBodega());
      case "Gastos":
        return alternarPanel("gastos");
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

  function entrar(event) {
    event.preventDefault();
    setAviso("");
    enviarJson("/api/acceso", { clave }, "Contraseña incorrecta.")
      .then(() => setAutorizado(true))
      .catch((err) => setAviso(err.message));
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
        <h1 style={{ margin: 0, fontSize: 22 }}>Administración</h1>
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
      {!autorizado && <FormularioClave clave={clave} setClave={setClave} aviso={aviso} alEnviar={entrar} />}
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
            "Stock detallado",
            "Planilla de inventario",
            "Movimientos",
            "Planilla de ventas",
            "Editar contratistas",
            "Gastos",
            "Bitacora camion",
          ]
            .filter((nombre) => !(esExt && nombre === "Añadir/cargar datos"))
            .filter((nombre) => ((puedeEditar || esExt) || !BOTONES_SOLO_M501.has(nombre)) && ((rol === "admin" || esExt) || !BOTONES_SOLO_ADMIN.has(nombre)))
            .map((nombre, indice, lista) => {
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
                {nombre === "Bitacora camion" ? "Bitácora camión" : nombre === "Planilla de ventas" ? "Ventas y Traspasos" : nombre}
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
        <Bitacora clave={clave} colores={colores} />
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
      {autorizado && mostrarGastos && (
        <section style={{ color: "var(--texto)" }}>
          <CuerpoGastos Titulo="h2" />
        </section>
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
          soloLectura={rol !== "admin"}
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
          pegarColumna={pegarColumnaDetallado}
          pendientes={pendientesDetallado}
          guardando={guardandoDetallado}
          onGuardar={guardarCambiosDetallado}
          soloLectura={!puedeEditar}
        />
      )}
      {autorizado && <PanelReserva visible={mostrarReserva} colores={colores} clasePlanilla={clasePlanilla} />}
      {autorizado && mostrarVentas && (
        <fieldset disabled={esExt} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <Ventas colores={colores} listaContratistas={listaContratistas} />
        </fieldset>
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
          soloLectura={rol !== "admin"}
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
        <DialogoConfirmacion
          etiqueta="Confirmar cambios en contratistas"
          titulo="¿Guardar los cambios en contratistas?"
          texto="Se reemplazará la lista de contratistas que se puede elegir al cargar ventas. ¿Estás seguro de realizar el cambio?"
          acciones={[
            { texto: "Sí, guardar cambios", alClick: guardarContratistasConfirmado, principal: true },
            { texto: "Cancelar", alClick: () => setConfirmarContratistas(false) },
          ]}
        />
      )}
      {mostrarAviso && (
        <DialogoConfirmacion
          titulo={importando ? "Importación en curso" : "Hay cambios sin guardar"}
          texto={
            importando
              ? "Espera a que termine la carga. Si sales ahora se interrumpe la importación."
              : "Si sales de esta página se pierden los datos que todavía no guardaste."
          }
          acciones={[
            { texto: "Seguir en esta página", alClick: seguirAqui, principal: true },
            ...(importando ? [] : [{ texto: "Salir sin guardar", alClick: salirSinGuardar }]),
          ]}
        />
      )}
      <div className="footer">
        <p>© 2026 Berfre - Práctica 2 - Transformación digital - React - Anibal Alexis Muñoz Reyes - UNAB</p>
    </div>
    </main>
  );
}

