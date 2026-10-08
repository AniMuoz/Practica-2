import { useEffect, useRef, useState } from "react";
import { useColoresPlanilla } from "./ColoresPlanilla.jsx";
import { useBlocker, useNavigate } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import { iniciarRecorrido, recorridoPendiente } from "./Recorrido.jsx";
import Planilla from "./Planilla.jsx";
import {
  claveUltimaCarga,
  colorCantidad,
  colorLibre,
  colorStockDetallado,
  filasInventarioVisibles,
  rutaExcel,
  rutaExcelInventario,
  validarContratistas,
} from "./reglasPlanilla.js";

const IMAGENES = new Set(["Rombo", "QR", "Foto"]);
const ALTO_FILA = 36;
const FILAS_EXTRA = 12;

function VistaPrevia({ filas, columnas, altoMaximo = 480, className, children, renderFila, vacio, clave, alFinal }) {
  const ref = useRef(null);
  const [corte, setCorte] = useState({ inicio: 0, fin: 40 });
  const marca = clave === undefined ? filas.length : clave;

  function medir() {
    const caja = ref.current;
    if (!caja) return;
    const inicio = Math.max(0, Math.floor(caja.scrollTop / ALTO_FILA) - FILAS_EXTRA);
    const cupo = Math.ceil(caja.clientHeight / ALTO_FILA) + FILAS_EXTRA * 2;
    const fin = Math.min(filas.length, inicio + cupo);
    setCorte((actual) => (actual.inicio === inicio && actual.fin === fin ? actual : { inicio, fin }));
    if (alFinal && caja.scrollHeight - caja.scrollTop - caja.clientHeight < ALTO_FILA * 6) alFinal();
  }

  useEffect(() => {
    const caja = ref.current;
    if (caja) caja.scrollTop = 0;
    medir();
  }, [marca]);

  useEffect(() => {
    medir();
  }, [filas.length]);

  const antes = corte.inicio * ALTO_FILA;
  const despues = Math.max(0, filas.length - corte.fin) * ALTO_FILA;
  const span = Math.max(columnas, 1);

  return (
    <div ref={ref} onScroll={medir} style={{ overflow: "auto", maxHeight: altoMaximo }}>
      <Planilla className={["vista-previa", className].filter(Boolean).join(" ")}>
        {children}
        <tbody>
          {antes > 0 && (
            <tr aria-hidden="true">
              <td colSpan={span} style={{ height: antes, padding: 0, border: 0 }} />
            </tr>
          )}
          {filas.slice(corte.inicio, corte.fin).map((fila, desplazamiento) => renderFila(fila, corte.inicio + desplazamiento))}
          {despues > 0 && (
            <tr aria-hidden="true">
              <td colSpan={span} style={{ height: despues, padding: 0, border: 0 }} />
            </tr>
          )}
        </tbody>
      </Planilla>
      {filas.length === 0 && vacio && <p style={{ margin: "12px 0 0" }}>{vacio}</p>}
    </div>
  );
}

function Interruptor({ activo, onClick, texto }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: 0,
        border: "none",
        background: "transparent",
        color: "inherit",
        cursor: "pointer",
        fontSize: 14,
      }}
    >
      <span
        style={{
          width: 40,
          height: 22,
          borderRadius: 999,
          background: activo ? "var(--boton)" : "var(--borde)",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: activo ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.15s ease",
          }}
        />
      </span>
      {texto}
    </button>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const { colores, oscuro } = useColoresPlanilla();
  const clasePlanilla = oscuro && colores ? "planilla-oscura" : undefined;
  const excel = (ruta) => rutaExcel(ruta, colores);
  const [autorizado, setAutorizado] = useState(false);
  const [clave, setClave] = useState("");
  const [columnas, setColumnas] = useState([]);
  const [datos, setDatos] = useState({});
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [importando, setImportando] = useState(false);
  const [avisoCarga, setAvisoCarga] = useState("");
  const [ultimasCargas, setUltimasCargas] = useState({});
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
  const [copiarExistencia, setCopiarExistencia] = useState(false);
  const [copiarInventario, setCopiarInventario] = useState(false);
  const [mostrarInventarioBodega, setMostrarInventarioBodega] = useState(false);
  const [bodegasInventario, setBodegasInventario] = useState([]);
  const [cargandoInventarioBodega, setCargandoInventarioBodega] = useState(false);
  const [avisoInventarioBodega, setAvisoInventarioBodega] = useState("");
  const excelInventario = (ruta) => rutaExcelInventario(ruta, colores, copiarInventario, copiarExistencia);
  function alternarExistencia() {
    if (copiarExistencia) {
      setCopiarExistencia(false);
      return;
    }
    const confirmar = window.confirm("¿Querés poner en la columna Existencia los datos de Libre utilización?");
    if (!confirmar) return;
    setCopiarInventario(false);
    setCopiarExistencia(true);
  }
  function alternarInventario() {
    if (copiarInventario) {
      setCopiarInventario(false);
      return;
    }
    const confirmar = window.confirm("¿Querés poner en la columna Existencia los datos de la columna Inventario?");
    if (!confirmar) return;
    setCopiarExistencia(false);
    setCopiarInventario(true);
  }
  const filasInventario = filasInventarioVisibles(inventario.filas, copiarInventario, copiarExistencia);
  const [mostrarDetallado, setMostrarDetallado] = useState(false);
  const [detallado, setDetallado] = useState({ columnas: [], filas: [] });
  const [cargandoDetallado, setCargandoDetallado] = useState(false);
  const [avisoDetallado, setAvisoDetallado] = useState("");
  const [mostrarReserva, setMostrarReserva] = useState(false);
  const [archivoReserva, setArchivoReserva] = useState(null);
  const [reserva, setReserva] = useState({ columnas: [], filas: [] });
  const [revisandoReserva, setRevisandoReserva] = useState(false);
  const [avisoReserva, setAvisoReserva] = useState("");
  const [ordenReserva, setOrdenReserva] = useState("");
  const [busquedaReserva, setBusquedaReserva] = useState({ columnas: [], filas: [], total: 0 });
  const [buscandoReserva, setBuscandoReserva] = useState(false);
  const [avisoBusquedaReserva, setAvisoBusquedaReserva] = useState("");
  const [mostrarContratistas, setMostrarContratistas] = useState(false);
  const [contratistas, setContratistas] = useState([]);
  const [cargandoContratistas, setCargandoContratistas] = useState(false);
  const [guardandoContratistas, setGuardandoContratistas] = useState(false);
  const [avisoContratistas, setAvisoContratistas] = useState("");
  const [mostrarVentas, setMostrarVentas] = useState(false);
  const [ordenVenta, setOrdenVenta] = useState(null);
  const [archivoVentas, setArchivoVentas] = useState(null);
  const [listaContratistas, setListaContratistas] = useState([]);
  const [contratistaVenta, setContratistaVenta] = useState("1");
  const [movimientoVenta, setMovimientoVenta] = useState("1");
  const [modoVenta, setModoVenta] = useState("orden");
  const [productosVenta, setProductosVenta] = useState([{ codigo: "", cantidad: "" }]);
  const [codVenta, setCodVenta] = useState("");
  const [almacenVenta, setAlmacenVenta] = useState("M501");
  const [procesandoVenta, setProcesandoVenta] = useState(false);
  const [avisoVenta, setAvisoVenta] = useState("");
  const [baseContratistas, setBaseContratistas] = useState("[]");
  const [salidaPendiente, setSalidaPendiente] = useState(null);
  const [ventaKey, setVentaKey] = useState(0);
  const [cargaKey, setCargaKey] = useState(0);
  const permitirSalida = useRef(false);
  const paginaReserva = useRef(0);
  const cargandoPaginaReserva = useRef(false);
  const hayMasReservas = useRef(false);
  const hayCambiosRef = useRef(false);

  function fijarContratistas(filas) {
    const lista = filas || [];
    setContratistas(lista);
    setBaseContratistas(JSON.stringify(lista));
  }

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

  function cargarPlanilla(url, setCargando, setAviso, setTabla, mensaje, silencioso = false) {
    if (!silencioso) setCargando(true);
    setAviso("");
    return fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || mensaje);
        setTabla({ columnas: data.columnas || [], filas: data.filas || [], marcados: data.marcados || [] });
      })
      .catch((err) => setAviso(err.message))
      .finally(() => setCargando(false));
  }

  function cargarNombresContratistas() {
    return fetch("/api/contratistas", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const nombres = (data.filas || []).map((fila) => fila.nombre).filter(Boolean);
        setListaContratistas(nombres);
        setContratistaVenta((actual) => {
          const indice = Number(actual);
          if (indice >= 1 && indice <= nombres.length) return actual;
          return nombres.length ? "1" : "1";
        });
        return data.filas || [];
      });
  }

  function cerrarPaneles(permitidos) {
    const ok = new Set(permitidos);
    if (!ok.has("carga")) setMostrarCarga(false);
    if (!ok.has("formulario")) setMostrarFormulario(false);
    if (!ok.has("bodega")) setMostrarBodega(false);
    if (!ok.has("regional")) setMostrarRegional(false);
    if (!ok.has("inventario")) setMostrarInventario(false);
    if (!ok.has("inventarioBodega")) setMostrarInventarioBodega(false);
    if (!ok.has("detallado")) setMostrarDetallado(false);
    if (!ok.has("reserva")) setMostrarReserva(false);
    if (!ok.has("ventas")) setMostrarVentas(false);
    if (!ok.has("contratistas")) setMostrarContratistas(false);
  }

  function cargarUltimasCargas() {
    return fetch("/api/tabla/ultimas-cargas", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setUltimasCargas(data.cargas || {}))
      .catch(() => {});
  }

  function textoUltimaCarga() {
    const clave = claveUltimaCarga(modoCarga, columnaCarga);
    const iso = ultimasCargas[clave];
    if (!iso) return "Todavía no hay una carga registrada para esta opción.";
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return "Todavía no hay una carga registrada para esta opción.";
    const texto = fecha.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Último cambio: ${texto}`;
  }

  function cargarInventarioBodega(silencioso = false) {
    if (!silencioso) setCargandoInventarioBodega(true);
    setAvisoInventarioBodega("");
    return fetch("/api/inventario-bodega", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo leer el inventario por bodega.");
        setBodegasInventario(data.bodegas || []);
      })
      .catch((err) => setAvisoInventarioBodega(err.message))
      .finally(() => setCargandoInventarioBodega(false));
  }

  function refrescarVistas(silencioso = false) {
    fetch("/api/tabla", { cache: "no-store" })
      .then((res) => res.json())
      .then(aplicarColumnas)
      .catch(() => setAviso("No se pudo cargar la tabla."));
    if (mostrarBodega) cargarPlanilla("/api/bodega", setCargandoBodega, setAvisoBodega, setBodega, "No se pudo leer el stock.", silencioso);
    if (mostrarRegional) cargarPlanilla("/api/regional", setCargandoRegional, setAvisoRegional, setRegional, "No se pudo leer el stock regional.", silencioso);
    if (mostrarInventario) cargarPlanilla("/api/inventario", setCargandoInventario, setAvisoInventario, setInventario, "No se pudo leer el inventario.", silencioso);
    if (mostrarInventarioBodega) cargarInventarioBodega(silencioso);
    if (mostrarDetallado) cargarPlanilla("/api/stock-detallado", setCargandoDetallado, setAvisoDetallado, setDetallado, "No se pudo leer el stock detallado.", silencioso);
    if (mostrarContratistas || mostrarVentas) {
      cargarNombresContratistas()
        .then((filas) => {
          if (mostrarContratistas) fijarContratistas(filas);
        })
        .catch(() => {
          if (mostrarContratistas) setAvisoContratistas("No se pudo leer los contratistas.");
          if (mostrarVentas) setAvisoVenta("No se pudo cargar los contratistas.");
        });
    }
  }

  const refrescarRef = useRef(() => {});
  refrescarRef.current = () => refrescarVistas(true);

  useEffect(() => {
    const fuente = new EventSource("/api/eventos");
    let pendiente = 0;
    fuente.onmessage = (evento) => {
      let data;
      try {
        data = JSON.parse(evento.data);
      } catch {
        return;
      }
      if (data.tipo !== "recarga" && data.tipo !== "fila") return;
      window.clearTimeout(pendiente);
      pendiente = window.setTimeout(() => refrescarRef.current(), 200);
    };
    return () => {
      window.clearTimeout(pendiente);
      fuente.close();
    };
  }, []);

  const formularioSinGuardar =
    mostrarFormulario && columnas.some((columna) => String(datos[columna] ?? "").trim() !== "");
  const contratistasSinGuardar =
    mostrarContratistas && JSON.stringify(contratistas) !== baseContratistas;
  const ventaSinGuardar =
    mostrarVentas &&
    Boolean(
      ordenVenta ||
        archivoVentas ||
        modoVenta !== "orden" ||
        productosVenta.some((fila) => String(fila.codigo).trim() || String(fila.cantidad).trim()) ||
        movimientoVenta !== "1" ||
        contratistaVenta !== "1" ||
        (movimientoVenta === "2" && almacenVenta !== "M501") ||
        String(codVenta).trim() !== ""
    );
  const cargaSinGuardar = mostrarCarga && Boolean(archivo);
  const hayCambiosSinGuardar = formularioSinGuardar || contratistasSinGuardar || ventaSinGuardar || cargaSinGuardar;
  hayCambiosRef.current = hayCambiosSinGuardar;

  function intentarSalir(accion) {
    if (!hayCambiosRef.current) {
      accion();
      return;
    }
    setSalidaPendiente(() => accion);
  }

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
    if (contratistasSinGuardar) setContratistas(JSON.parse(baseContratistas));
    if (cargaSinGuardar) {
      setArchivo(null);
      setCargaKey((actual) => actual + 1);
    }
    if (ventaSinGuardar) {
      setOrdenVenta(null);
      setArchivoVentas(null);
      setContratistaVenta("1");
      setMovimientoVenta("1");
      setCodVenta("");
      setVentaKey((actual) => actual + 1);
    }
  }

  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !permitirSalida.current &&
      hayCambiosRef.current &&
      currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (!hayCambiosSinGuardar) return undefined;
    function avisarCierre(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", avisarCierre);
    return () => window.removeEventListener("beforeunload", avisarCierre);
  }, [hayCambiosSinGuardar]);

  useEffect(() => {
    if (!autorizado) return;
    fetch("/api/tabla", { cache: "no-store" })
      .then((res) => res.json())
      .then(aplicarColumnas)
      .catch(() => setAviso("No se pudo cargar la tabla."));
    cargarUltimasCargas();
    if (recorridoPendiente("admin")) iniciarRecorrido("admin");
  }, [autorizado]);

  return (
    <main
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
      <h1 style={{ margin: "0 0 16px", fontSize: 22 }}>Agregar material</h1>
      {!autorizado && (
        <form
          data-tour="admin-clave"
          onSubmit={(event) => {
            event.preventDefault();
            setAviso("");
            fetch("/api/acceso", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clave }),
            })
              .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || "Contraseña incorrecta.");
                setAutorizado(true);
              })
              .catch((err) => setAviso(err.message));
          }}
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          <input
            type="password"
            value={clave}
            autoFocus
            placeholder="Contraseña"
            onChange={(event) => setClave(event.target.value)}
            style={{ padding: "8px 12px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
          />
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
      {autorizado && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {[
            "Añadir un dato",
            "Carga de datos",
            "Stock en bodega",
            "Stock regional",
            "Planilla de inventario",
            "Inventario por bodega",
            "Stock detallado",
            "Revisar stock de reserva",
            "Planilla de ventas",
            "Editar contratistas",
          ].map((nombre) => {
            const activo =
              (nombre === "Carga de datos" && mostrarCarga) ||
              (nombre === "Añadir un dato" && mostrarFormulario) ||
              (nombre === "Stock en bodega" && mostrarBodega) ||
              (nombre === "Stock regional" && mostrarRegional) ||
              (nombre === "Planilla de inventario" && mostrarInventario) ||
              (nombre === "Inventario por bodega" && mostrarInventarioBodega) ||
              (nombre === "Stock detallado" && mostrarDetallado) ||
              (nombre === "Revisar stock de reserva" && mostrarReserva) ||
              (nombre === "Editar contratistas" && mostrarContratistas) ||
              (nombre === "Planilla de ventas" && mostrarVentas);
            return (
              <button
                key={nombre}
                data-tour={nombre}
                type="button"
                onClick={() => {
                  const cambiar = () => {
                  if (nombre === "Carga de datos") {
                    const abrir = !mostrarCarga;
                    if (abrir) cerrarPaneles(["carga", "formulario"]);
                    setMostrarCarga(abrir);
                  }
                  if (nombre === "Añadir un dato") {
                    const abrir = !mostrarFormulario;
                    if (abrir) cerrarPaneles(["carga", "formulario"]);
                    setMostrarFormulario(abrir);
                  }
                  if (nombre === "Stock en bodega") {
                    const abrir = !mostrarBodega;
                    if (abrir) {
                      cerrarPaneles(["bodega"]);
                      cargarPlanilla("/api/bodega", setCargandoBodega, setAvisoBodega, setBodega, "No se pudo leer el stock.");
                    }
                    setMostrarBodega(abrir);
                  }
                  if (nombre === "Stock regional") {
                    const abrir = !mostrarRegional;
                    if (abrir) {
                      cerrarPaneles(["regional"]);
                      cargarPlanilla("/api/regional", setCargandoRegional, setAvisoRegional, setRegional, "No se pudo leer el stock regional.");
                    }
                    setMostrarRegional(abrir);
                  }
                  if (nombre === "Planilla de inventario") {
                    const abrir = !mostrarInventario;
                    if (abrir) {
                      cerrarPaneles(["inventario"]);
                      cargarPlanilla("/api/inventario", setCargandoInventario, setAvisoInventario, setInventario, "No se pudo leer el inventario.");
                    }
                    setMostrarInventario(abrir);
                  }
                  if (nombre === "Inventario por bodega") {
                    const abrir = !mostrarInventarioBodega;
                    if (abrir) {
                      cerrarPaneles(["inventarioBodega"]);
                      cargarInventarioBodega();
                    }
                    setMostrarInventarioBodega(abrir);
                  }
                  if (nombre === "Stock detallado") {
                    const abrir = !mostrarDetallado;
                    if (abrir) {
                      cerrarPaneles(["detallado"]);
                      cargarPlanilla("/api/stock-detallado", setCargandoDetallado, setAvisoDetallado, setDetallado, "No se pudo leer el stock detallado.");
                    }
                    setMostrarDetallado(abrir);
                  }
                  if (nombre === "Revisar stock de reserva") {
                    const abrir = !mostrarReserva;
                    if (abrir) cerrarPaneles(["reserva"]);
                    setMostrarReserva(abrir);
                  }
                  if (nombre === "Planilla de ventas") {
                    const abrir = !mostrarVentas;
                    if (abrir) {
                      cerrarPaneles(["ventas", "contratistas"]);
                      cargarNombresContratistas().catch(() => setAvisoVenta("No se pudo cargar los contratistas."));
                    }
                    setMostrarVentas(abrir);
                  }
                  if (nombre === "Editar contratistas") {
                    const abrir = !mostrarContratistas;
                    if (abrir) {
                      cerrarPaneles(["ventas", "contratistas"]);
                      setCargandoContratistas(true);
                      setAvisoContratistas("");
                      fetch("/api/contratistas", { cache: "no-store" })
                        .then(async (res) => {
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || "No se pudo leer los contratistas.");
                          fijarContratistas(data.filas || []);
                          const nombres = (data.filas || []).map((fila) => fila.nombre).filter(Boolean);
                          setListaContratistas(nombres);
                        })
                        .catch((err) => setAvisoContratistas(err.message))
                        .finally(() => setCargandoContratistas(false));
                    }
                    setMostrarContratistas(abrir);
                  }
                  };
                  intentarSalir(cambiar);
                }}
                style={{
                  padding: "8px 14px",
                  border: activo ? "1px solid var(--acento)" : "1px solid var(--borde)",
                  borderRadius: 6,
                  background: activo ? "var(--acento)" : "var(--superficie)",
                  color: activo ? "var(--sobre)" : "var(--texto)",
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
          key={cargaKey}
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
            const secciones = {
              completa: "Planilla completa",
              sap: "Planilla EXPORT SAP",
              ubicaciones: "Planilla de ubicaciones",
              precios: "Planilla de precios",
              "dos-columnas": columnaCarga
                ? `Planilla de 2 columnas (columna ${columnaCarga})`
                : "Planilla de 2 columnas",
              reservas: "Añadir reservas",
            };
            const seccion = secciones[modoCarga] || modoCarga;
            const confirmar = window.confirm(
              `¿Confirmás la carga del archivo "${archivo.name}" en la sección ${seccion}?`
            );
            if (!confirmar) return;
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
                cargarUltimasCargas();
                refrescarVistas();
              })
              .catch((err) => setAvisoCarga(err.message))
              .finally(() => setImportando(false));
          }}
          style={{
            background: "var(--superficie)",
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
            style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
          >
            <option value="completa">Planilla completa</option>
            <option value="sap">Planilla EXPORT SAP</option>
            <option value="ubicaciones">Planilla de ubicaciones</option>
            <option value="precios">Planilla de precios</option>
            <option value="dos-columnas">Planilla de 2 columnas</option>
            <option value="reservas">Añadir reservas</option>
          </select>
          {modoCarga === "dos-columnas" && (
            <select
              aria-label="Columna a llenar"
              value={columnaCarga}
              onChange={(event) => setColumnaCarga(event.target.value)}
              style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
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
              background: "var(--boton)",
              color: "var(--sobre)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {importando ? "Importando..." : "Importar planilla"}
          </button>
          <p style={{ margin: 0, fontSize: 14, flexBasis: "100%" }}>{textoUltimaCarga()}</p>
          {avisoCarga && <p style={{ margin: 0, fontSize: 14 }}>{avisoCarga}</p>}
        </form>
      )}
      {autorizado && mostrarBodega && (
        <section
          style={{
            background: "var(--superficie)",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Bodega M501</h2>
            <a
              href={excel("/api/bodega/excel")}
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
          {cargandoBodega && <p style={{ margin: 0 }}>Cargando stock...</p>}
          {avisoBodega && <p style={{ margin: 0 }}>{avisoBodega}</p>}
          {!cargandoBodega && !avisoBodega && (
            <VistaPrevia
              filas={bodega.filas}
              columnas={bodega.columnas.length}
              className={clasePlanilla}
              vacio="No hay stock de M501 cargado."
              renderFila={(fila, indice) => {
                const fondo = colorLibre(fila[2]);
                return (
                  <tr key={`${fila[0]}-${indice}`}>
                    {fila.map((valor, columna) => (
                      <td
                        key={columna}
                        className={colores && columna === 2 ? "celda-color" : undefined}
                        style={{
                          padding: "8px 10px",
                          border: "1px solid var(--borde-suave)",
                          background: colores && columna === 2 ? fondo : "var(--superficie)",
                        }}
                      >
                        {valor === "" || valor == null ? "" : String(valor)}
                      </td>
                    ))}
                  </tr>
                );
              }}
            >
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
                          background: colores ? "#a9e5e5" : "var(--superficie)",
                          border: "1px solid var(--borde)",
                        }}
                      >
                        {columna}
                      </th>
                    ))}
                  </tr>
                </thead>
            </VistaPrevia>
          )}
        </section>
      )}
      {autorizado && mostrarRegional && (
        <section
          style={{
            background: "var(--superficie)",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Stock por bodega</h2>
            <a
              href={excel("/api/regional/excel")}
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
          {cargandoRegional && <p style={{ margin: 0 }}>Cargando stock...</p>}
          {avisoRegional && <p style={{ margin: 0 }}>{avisoRegional}</p>}
          {!cargandoRegional && !avisoRegional && (
            <VistaPrevia
              filas={regional.filas}
              columnas={regional.columnas.length}
              className={clasePlanilla}
              vacio="No hay stock regional cargado."
              renderFila={(fila, indice) => (
                <tr key={`${fila[0]}-${indice}`}>
                  {fila.map((valor, columna) => {
                    const fondo = columna < 2 ? "var(--superficie)" : colorCantidad(valor);
                    return (
                      <td
                        key={columna}
                        className={colores && columna >= 2 ? "celda-color" : undefined}
                        style={{
                          padding: "8px 10px",
                          border: "1px solid var(--borde-suave)",
                          background: colores ? fondo : "var(--superficie)",
                          fontWeight: columna === fila.length - 1 ? 700 : 400,
                        }}
                      >
                        {valor === "" || valor == null ? "" : String(valor)}
                      </td>
                    );
                  })}
                </tr>
              )}
            >
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
                          background: colores ? "#a9e5e5" : "var(--superficie)",
                          border: "1px solid var(--borde)",
                        }}
                      >
                        {columna}
                      </th>
                    ))}
                  </tr>
                </thead>
            </VistaPrevia>
          )}
        </section>
      )}
      {autorizado && mostrarInventario && (
        <section
          style={{
            background: "var(--superficie)",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Inventario por lugar</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <Interruptor activo={copiarExistencia} onClick={alternarExistencia} texto="Libre utilización" />
              <Interruptor activo={copiarInventario} onClick={alternarInventario} texto="Inventario" />
            <a
              href={excelInventario("/api/inventario/excel")}
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
          </div>
          {cargandoInventario && <p style={{ margin: 0 }}>Cargando inventario...</p>}
          {avisoInventario && <p style={{ margin: 0 }}>{avisoInventario}</p>}
          {!cargandoInventario && !avisoInventario && (
            <VistaPrevia
              filas={filasInventario}
              columnas={inventario.columnas.length}
              className={clasePlanilla}
              vacio="No hay materiales para inventariar."
              renderFila={(fila, indice) => (
                <tr key={`${fila[0]}-${indice}`}>
                  {fila.map((valor, columna) => (
                    <td
                      key={columna}
                      className={colores && (columna === 2 || columna === 3) && String(valor ?? "").trim() === "" ? "celda-color" : undefined}
                      style={{
                        padding: "8px 10px",
                        border: "1px solid var(--borde-suave)",
                        background:
                          colores && (columna === 2 || columna === 3) && String(valor ?? "").trim() === "" ? "#f9e37c" : "var(--superficie)",
                      }}
                    >
                      {valor === "" || valor == null ? "" : String(valor)}
                    </td>
                  ))}
                </tr>
              )}
            >
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
                          background: colores ? "#a9e5e5" : "var(--superficie)",
                          border: "1px solid var(--borde)",
                        }}
                      >
                        {columna}
                      </th>
                    ))}
                  </tr>
                </thead>
            </VistaPrevia>
          )}
        </section>
      )}
      {autorizado && mostrarInventarioBodega && (
        <section
          style={{
            background: "var(--superficie)",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Inventario por bodega</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <Interruptor activo={copiarExistencia} onClick={alternarExistencia} texto="Libre utilización" />
              <Interruptor activo={copiarInventario} onClick={alternarInventario} texto="Inventario" />
            </div>
          </div>
          {cargandoInventarioBodega && <p style={{ margin: 0 }}>Cargando bodegas...</p>}
          {avisoInventarioBodega && <p style={{ margin: 0 }}>{avisoInventarioBodega}</p>}
          {!cargandoInventarioBodega && !avisoInventarioBodega && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {bodegasInventario.map((bodegaItem) => (
                <div key={bodegaItem.codigo} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <span>Bodega {bodegaItem.codigo} ({bodegaItem.cantidad} materiales)</span>
                  <a
                    href={excelInventario(`/api/inventario-bodega/excel?bodega=${encodeURIComponent(bodegaItem.codigo)}`)}
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
              ))}
              {bodegasInventario.length === 0 && <p style={{ margin: 0 }}>No hay bodegas para inventariar.</p>}
            </div>
          )}
        </section>
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
              href={excel("/api/stock-detallado/excel")}
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
          {cargandoDetallado && <p style={{ margin: 0 }}>Cargando stock...</p>}
          {avisoDetallado && <p style={{ margin: 0 }}>{avisoDetallado}</p>}
          {!cargandoDetallado && !avisoDetallado && (
            <VistaPrevia
              filas={detallado.filas}
              columnas={detallado.columnas.length}
              className={clasePlanilla}
              vacio="No hay stock detallado cargado."
              renderFila={(fila, indice) => (
                <tr key={`${fila[1]}-${indice}`}>
                  {fila.map((valor, columna) => {
                    const coloreada = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(columna);
                    const fondo = colorStockDetallado(columna, valor, detallado.marcados?.[indice]);
                    return (
                      <td
                        key={columna}
                        className={colores && coloreada ? "celda-color" : undefined}
                        style={{
                          padding: "8px 10px",
                          border: "1px solid var(--borde-suave)",
                          background: colores ? fondo : "var(--superficie)",
                          fontWeight: columna === 10 ? 700 : 400,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {valor === "" || valor == null ? "" : String(valor)}
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
          )}
        </section>
      )}
      {autorizado && mostrarReserva && (
        <section
          style={{
            background: "var(--superficie)",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Revisión de stock de reserva</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const numero = ordenReserva.trim();
              if (!numero) {
                setAvisoBusquedaReserva("Escribí un número de reserva.");
                setBusquedaReserva({ columnas: [], filas: [], total: 0 });
                return;
              }
              setAvisoBusquedaReserva("");
              setBuscandoReserva(true);
              paginaReserva.current = 0;
              hayMasReservas.current = false;
              fetch(`/api/reservas?reserva=${encodeURIComponent(numero)}&pagina=0&tamano=100`)
                .then(async (res) => {
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "No se pudo buscar la reserva.");
                  const coincidencias = data.coincidencias ?? (data.filas || []).length;
                  setBusquedaReserva({
                    columnas: data.columnas || [],
                    filas: data.filas || [],
                    total: data.total || 0,
                    consulta: numero,
                  });
                  hayMasReservas.current = (data.filas || []).length < coincidencias;
                  if ((data.total || 0) === 0) setAvisoBusquedaReserva("Todavía no hay reservas cargadas.");
                  else if (coincidencias === 0) setAvisoBusquedaReserva("No hay reservas con ese número de reserva.");
                })
                .catch((err) => setAvisoBusquedaReserva(err.message))
                .finally(() => setBuscandoReserva(false));
            }}
            style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 16 }}
          >
            <input
              type="search"
              aria-label="Número de reserva"
              value={ordenReserva}
              placeholder="Buscar número de reserva"
              onChange={(event) => setOrdenReserva(event.target.value)}
              style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14, minWidth: 220 }}
            />
            <button
              type="submit"
              disabled={buscandoReserva}
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
              {buscandoReserva ? "Buscando..." : "Buscar reserva"}
            </button>
            <button
              type="button"
              disabled={busquedaReserva.filas.length === 0}
              onClick={() => {
                const numero = ordenReserva.trim();
                if (!numero) return;
                const params = new URLSearchParams({ reserva: numero, colores: colores ? "1" : "0" });
                fetch(`/api/reservas/excel?${params.toString()}`)
                  .then(async (res) => {
                    if (!res.ok) {
                      const data = await res.json();
                      throw new Error(data.error || "No se pudo descargar.");
                    }
                    return res.blob();
                  })
                  .then((blob) => {
                    const url = URL.createObjectURL(blob);
                    const enlace = document.createElement("a");
                    enlace.href = url;
                    enlace.download = "Revision stock en reserva.xlsx";
                    enlace.click();
                    URL.revokeObjectURL(url);
                  })
                  .catch((err) => setAvisoBusquedaReserva(err.message));
              }}
              style={{
                padding: "8px 14px",
                border: 0,
                borderRadius: 6,
                background: busquedaReserva.filas.length === 0 ? "var(--pista)" : "var(--acento)",
                color: "var(--sobre)",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Descargar planilla
            </button>
            {avisoBusquedaReserva && <p style={{ margin: 0, fontSize: 14 }}>{avisoBusquedaReserva}</p>}
          </form>
          {busquedaReserva.columnas.length > 0 && (
            <div style={{ marginBottom: 16 }}>
            <VistaPrevia
              filas={busquedaReserva.filas}
              columnas={busquedaReserva.columnas.length}
              altoMaximo={320}
              clave={busquedaReserva.consulta}
              alFinal={() => {
                const numero = busquedaReserva.consulta;
                if (!numero || !hayMasReservas.current || cargandoPaginaReserva.current) return;
                cargandoPaginaReserva.current = true;
                const pagina = paginaReserva.current + 1;
                fetch(`/api/reservas?reserva=${encodeURIComponent(numero)}&pagina=${pagina}&tamano=100`)
                  .then(async (res) => {
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "No se pudo buscar la reserva.");
                    const lote = data.filas || [];
                    paginaReserva.current = pagina;
                    const coincidencias = data.coincidencias ?? lote.length;
                    hayMasReservas.current = (pagina + 1) * 100 < coincidencias;
                    setBusquedaReserva((actual) => ({
                      ...actual,
                      columnas: data.columnas || actual.columnas,
                      filas: actual.filas.concat(lote),
                    }));
                  })
                  .catch(() => {
                    hayMasReservas.current = false;
                  })
                  .finally(() => {
                    cargandoPaginaReserva.current = false;
                  });
              }}
              className={clasePlanilla}
              renderFila={(fila, indice) => (
                <tr key={indice}>
                  {busquedaReserva.columnas.map((nombre, columna) => {
                    const esEstado = nombre === "Estado";
                    const valor = fila[columna];
                    return (
                      <td
                        key={columna}
                        style={{
                          padding: "8px 10px",
                          border: "1px solid var(--borde-suave)",
                          background:
                            colores && esEstado
                              ? valor === "Disponible"
                                ? "#73c883"
                                : "#f9e37c"
                              : "var(--superficie)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {valor === "" || valor == null ? "" : String(valor)}
                      </td>
                    );
                  })}
                </tr>
              )}
            >
                <thead>
                  <tr>
                    {busquedaReserva.columnas.map((columna) => (
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
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!archivoReserva) {
                setAvisoReserva("Elegí el PDF de la reserva.");
                return;
              }
              setAvisoReserva("");
              setRevisandoReserva(true);
              const cuerpo = new FormData();
              cuerpo.append("archivo", archivoReserva);
              fetch("/api/reserva", { method: "POST", body: cuerpo })
                .then(async (res) => {
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "No se pudo leer la reserva.");
                  setReserva({ columnas: data.columnas || [], filas: data.filas || [] });
                })
                .catch((err) => setAvisoReserva(err.message))
                .finally(() => setRevisandoReserva(false));
            }}
            style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 12 }}
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                setArchivoReserva(event.target.files?.[0] || null);
                setReserva({ columnas: [], filas: [] });
              }}
            />
            <button
              type="submit"
              disabled={revisandoReserva}
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
              {revisandoReserva ? "Revisando..." : "Revisar reserva"}
            </button>
            <button
              type="button"
              disabled={!archivoReserva || reserva.filas.length === 0}
              onClick={() => {
                const cuerpo = new FormData();
                cuerpo.append("archivo", archivoReserva);
                cuerpo.append("colores", colores ? "1" : "0");
                fetch("/api/reserva/excel", { method: "POST", body: cuerpo })
                  .then(async (res) => {
                    if (!res.ok) {
                      const data = await res.json();
                      throw new Error(data.error || "No se pudo descargar.");
                    }
                    return res.blob();
                  })
                  .then((blob) => {
                    const url = URL.createObjectURL(blob);
                    const enlace = document.createElement("a");
                    enlace.href = url;
                    enlace.download = "Revision stock en reserva.xlsx";
                    enlace.click();
                    URL.revokeObjectURL(url);
                  })
                  .catch((err) => setAvisoReserva(err.message));
              }}
              style={{
                padding: "8px 14px",
                border: 0,
                borderRadius: 6,
                background: reserva.filas.length === 0 ? "var(--pista)" : "var(--acento)",
                color: "var(--sobre)",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Descargar planilla
            </button>
            {avisoReserva && <p style={{ margin: 0, fontSize: 14 }}>{avisoReserva}</p>}
          </form>
          {reserva.columnas.length > 0 && (
            <VistaPrevia
              filas={reserva.filas}
              columnas={reserva.columnas.length}
              className={clasePlanilla}
              vacio="El PDF no tiene líneas de reserva."
              renderFila={(fila) => (
                <tr key={fila[0]}>
                  {fila.map((valor, columna) => (
                    <td
                      key={columna}
                      className={colores && columna === 7 ? "celda-color" : undefined}
                      style={{
                        padding: "8px 10px",
                        border: "1px solid var(--borde-suave)",
                        background:
                          !colores || columna !== 7 ? "var(--superficie)" : valor === "Disponible" ? "#73c883" : "#f9e37c",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {valor === "" || valor == null ? "" : String(valor)}
                    </td>
                  ))}
                </tr>
              )}
            >
                <thead>
                  <tr>
                    {reserva.columnas.map((columna) => (
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
          )}
        </section>
      )}
      {autorizado && mostrarVentas && (
        <section style={{ background: "var(--superficie)", borderRadius: 8, padding: 16, margin: "0 auto 16px", maxWidth: 640, width: "100%" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 18, textAlign: "center" }}>Añadir venta</h2>
          <form
            key={ventaKey}
            onSubmit={(event) => {
              event.preventDefault();
              if (modoVenta === "manual") {
                const validos = productosVenta.filter((fila) => String(fila.codigo).trim() && String(fila.cantidad).trim());
                if (validos.length === 0) {
                  setAvisoVenta("Agregá al menos un producto con código y cantidad.");
                  return;
                }
              } else if (!ordenVenta) {
                setAvisoVenta(movimientoVenta === "2" ? "Elegí el archivo de traspaso." : "Elegí el archivo de orden de venta.");
                return;
              }
              setAvisoVenta("");
              setProcesandoVenta(true);
              const cuerpo = new FormData();
              cuerpo.append("modo", modoVenta);
              if (modoVenta === "manual") {
                cuerpo.append("items", JSON.stringify(productosVenta.filter((fila) => String(fila.codigo).trim() && String(fila.cantidad).trim())));
              } else if (ordenVenta) {
                cuerpo.append("orden", ordenVenta);
              }
              if (archivoVentas) cuerpo.append("ventas", archivoVentas);
              cuerpo.append("contratista", contratistaVenta);
              cuerpo.append("movimiento", movimientoVenta);
              cuerpo.append("almacen", movimientoVenta === "2" ? almacenVenta : "M501");
              cuerpo.append("codVenta", movimientoVenta === "2" && modoVenta !== "manual" ? "n/a" : codVenta);
              cuerpo.append("colores", colores ? "1" : "0");
              fetch("/api/ventas", { method: "POST", body: cuerpo })
                .then(async (res) => {
                  if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || "No se pudo generar la venta.");
                  }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const enlace = document.createElement("a");
                  enlace.href = url;
                  enlace.download = `VENTAS ${new Date().getFullYear()}.xlsx`;
                  enlace.click();
                  URL.revokeObjectURL(url);
                  setOrdenVenta(null);
                  setArchivoVentas(null);
                  setContratistaVenta("1");
                  setMovimientoVenta("1");
                  setModoVenta("orden");
                  setProductosVenta([{ codigo: "", cantidad: "" }]);
                  setCodVenta("");
                  setAlmacenVenta("M501");
                  setVentaKey((actual) => actual + 1);
                })
                .catch((err) => setAvisoVenta(err.message))
                .finally(() => setProcesandoVenta(false));
            }}
            style={{ display: "grid", gap: 12 }}
          >
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Cómo cargar los productos
              <select
                value={modoVenta}
                onChange={(event) => setModoVenta(event.target.value)}
                style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6 }}
              >
                <option value="orden">Desde archivo (orden o traspaso)</option>
                <option value="manual">Producto a producto</option>
              </select>
            </label>
            {modoVenta === "orden" ? (
              <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
                {movimientoVenta === "2" ? "Archivo de traspaso" : "Archivo de orden de venta"}
                <input type="file" accept=".xlsx" onChange={(event) => setOrdenVenta(event.target.files?.[0] || null)} />
                <span style={{ fontSize: 12, color: "var(--texto-suave, #666)" }}>
                  {movimientoVenta === "2"
                    ? "Encabezados en la fila 3. El número se toma del título en C1. Código, descripción, medida, solicitado, entregar y CONCON se copian a la planilla."
                    : "Se lee la hoja de pedido: código, unidad y solicitado."}
                </span>
              </label>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 14 }}>Productos</span>
                {productosVenta.map((fila, indice) => (
                  <div key={indice} style={{ display: "flex", gap: 8 }}>
                    <input
                      value={fila.codigo}
                      placeholder="Código"
                      onChange={(event) => {
                        const copia = productosVenta.slice();
                        copia[indice] = { ...copia[indice], codigo: event.target.value };
                        setProductosVenta(copia);
                      }}
                      style={{ flex: 2, padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6 }}
                    />
                    <input
                      value={fila.cantidad}
                      placeholder="Cantidad"
                      inputMode="numeric"
                      onChange={(event) => {
                        const copia = productosVenta.slice();
                        copia[indice] = { ...copia[indice], cantidad: event.target.value };
                        setProductosVenta(copia);
                      }}
                      style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6 }}
                    />
                    <button
                      type="button"
                      onClick={() => setProductosVenta(productosVenta.filter((_, i) => i !== indice))}
                      style={{ padding: "8px 10px" }}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setProductosVenta([...productosVenta, { codigo: "", cantidad: "" }])}
                  style={{ padding: "6px 12px", justifySelf: "start" }}
                >
                  + Agregar producto
                </button>
              </div>
            )}
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Archivo de ventas existente (opcional)
              <input type="file" accept=".xlsx" onChange={(event) => setArchivoVentas(event.target.files?.[0] || null)} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Contratista
              <select
                value={contratistaVenta}
                onChange={(event) => setContratistaVenta(event.target.value)}
                style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6 }}
              >
                {listaContratistas.map((nombre, indice) => (
                  <option key={nombre} value={String(indice + 1)}>{nombre}</option>
                ))}
                <option value={String(listaContratistas.length + 1)}>n/a</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
              Tipo de movimiento
              <select
                value={movimientoVenta}
                onChange={(event) => setMovimientoVenta(event.target.value)}
                style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6 }}
              >
                <option value="1">Venta</option>
                <option value="2">Traspaso</option>
              </select>
            </label>
            {(movimientoVenta === "1" || (movimientoVenta === "2" && modoVenta === "manual")) && (
              <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
                Número de venta
                <input
                  value={codVenta}
                  placeholder="Ej: 12345"
                  onChange={(event) => setCodVenta(event.target.value)}
                  style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6 }}
                />
              </label>
            )}
            {movimientoVenta === "2" && (
              <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
                Almacén
                <select
                  value={almacenVenta}
                  onChange={(event) => setAlmacenVenta(event.target.value)}
                  style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6 }}
                >
                  {["M501", "M502", "M503", "M504", "M505"].map((bodega) => (
                    <option key={bodega} value={bodega}>{bodega}</option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="submit"
              disabled={procesandoVenta}
              style={{ padding: "8px 14px", border: 0, borderRadius: 6, background: "var(--acento)", color: "var(--sobre)", cursor: "pointer", justifySelf: "center" }}
            >
              {procesandoVenta ? "Procesando..." : "Procesar y descargar"}
            </button>
            {avisoVenta && <p style={{ margin: 0 }}>{avisoVenta}</p>}
          </form>
        </section>
      )}
      {autorizado && mostrarContratistas && (
        <section
          style={{
            background: "var(--superficie)",
            borderRadius: 8,
            padding: 16,
            margin: "0 auto 16px",
            maxWidth: 640,
            width: "100%",
          }}
        >
          <h2 style={{ margin: "0 0 12px", fontSize: 18, textAlign: "center" }}>Contratistas</h2>
          {cargandoContratistas && <p style={{ margin: 0 }}>Cargando contratistas...</p>}
          {avisoContratistas && <p style={{ margin: "0 0 12px" }}>{avisoContratistas}</p>}
          {!cargandoContratistas && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const errorContratistas = validarContratistas(contratistas);
                if (errorContratistas) {
                  setAvisoContratistas(errorContratistas);
                  return;
                }
                setAvisoContratistas("");
                setGuardandoContratistas(true);
                fetch("/api/contratistas", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ clave, filas: contratistas }),
                })
                  .then(async (res) => {
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
                    fijarContratistas(data.filas || []);
                    const nombres = (data.filas || []).map((fila) => fila.nombre).filter(Boolean);
                    setListaContratistas(nombres);
                    setAvisoContratistas("Contratistas guardados.");
                  })
                  .catch((err) => setAvisoContratistas(err.message))
                  .finally(() => setGuardandoContratistas(false));
              }}
            >
              <Planilla className={clasePlanilla}>
                <thead>
                  <tr>
                    {["id", "Nombre", ""].map((columna) => (
                      <th
                        key={columna || "accion"}
                        style={{
                          position: "sticky",
                          top: 0,
                          textAlign: "left",
                          padding: "8px 10px",
                          background: colores ? "#a9e5e5" : "var(--superficie)",
                          border: "1px solid var(--borde)",
                        }}
                      >
                        {columna}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contratistas.map((fila, indice) => (
                    <tr key={indice}>
                      <td style={{ padding: 6, border: "1px solid var(--borde-suave)" }}>
                        <input
                          value={fila.id}
                          inputMode="numeric"
                          onChange={(event) => {
                            const valor = event.target.value;
                            if (valor !== "" && !/^\d+$/.test(valor)) return;
                            setContratistas((actual) => actual.map((item, i) => (i === indice ? { ...item, id: valor } : item)));
                          }}
                          style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6 }}
                        />
                      </td>
                      <td style={{ padding: 6, border: "1px solid var(--borde-suave)" }}>
                        <input
                          value={fila.nombre}
                          onChange={(event) => {
                            const valor = event.target.value;
                            setContratistas((actual) => actual.map((item, i) => (i === indice ? { ...item, nombre: valor } : item)));
                          }}
                          style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6 }}
                        />
                      </td>
                      <td style={{ padding: 6, border: "1px solid var(--borde-suave)" }}>
                        <button
                          type="button"
                          onClick={() => setContratistas((actual) => actual.filter((_, i) => i !== indice))}
                          style={{ padding: "8px 10px", border: 0, borderRadius: 6, background: "var(--peligro)", color: "var(--sobre)", cursor: "pointer" }}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Planilla>
              <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => {
                    const siguiente = contratistas.reduce((maximo, fila) => Math.max(maximo, Number(fila.id) || 0), 0) + 1;
                    setContratistas((actual) => [...actual, { id: String(siguiente), nombre: "" }]);
                  }}
                  style={{ padding: "8px 14px", border: "1px solid var(--borde)", borderRadius: 6, background: "var(--superficie)", cursor: "pointer" }}
                >
                  Agregar
                </button>
                <button
                  type="submit"
                  disabled={guardandoContratistas}
                  style={{ padding: "8px 14px", border: 0, borderRadius: 6, background: "var(--acento)", color: "var(--sobre)", cursor: "pointer" }}
                >
                  {guardandoContratistas ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
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
                permitirSalida.current = true;
                navigate(`/${encodeURIComponent(data.fila.Codigo)}`);
              })
              .catch((err) => setAviso(err.message))
              .finally(() => setGuardando(false));
          }}
          className="form-admin"
          style={{
            background: "var(--superficie)",
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
                  border: "1px solid var(--borde)",
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
                background: "var(--acento)",
                color: "var(--sobre)",
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
      {(bloqueo.state === "blocked" || salidaPendiente) && (
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
            <p style={{ margin: "0 0 8px", fontWeight: 700 }}>Hay cambios sin guardar</p>
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              Si sales de esta página se pierden los datos que todavía no guardaste.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  if (bloqueo.state === "blocked") bloqueo.reset();
                  setSalidaPendiente(null);
                }}
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
              <button
                type="button"
                onClick={() => {
                  descartarCambios();
                  if (salidaPendiente) {
                    const seguir = salidaPendiente;
                    setSalidaPendiente(null);
                    seguir();
                  }
                  if (bloqueo.state === "blocked") bloqueo.proceed();
                }}
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
