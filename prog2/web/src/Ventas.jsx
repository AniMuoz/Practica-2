import { Fragment, useEffect, useRef, useState } from "react";
import Planilla from "./Planilla.jsx";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const CAMPO = { padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6 };
const ETIQUETA = { display: "grid", gap: 4, fontSize: 14 };
const TH = { padding: "6px 8px", textAlign: "left", background: "var(--acento)", color: "var(--sobre)", borderBottom: "2px solid var(--borde)", whiteSpace: "nowrap", position: "sticky", top: 0 };
const TD = { padding: "4px 8px", borderBottom: "1px solid var(--borde-suave)", whiteSpace: "nowrap" };

// [clave, titulo, editable]
const COLUMNAS = [
  ["pos", "Pos"], ["codigo", "Código"], ["descripcion", "Descripción"], ["ubicacion", "Ubicación"],
  ["m501", "M501"], ["m502", "M502"], ["m503", "M503"], ["m504", "M504"], ["m505", "M505"],
  ["solicitado", "Solicitado"], ["entregar", "Entregar", true], ["med", "Med"], ["tiras", "Tiras"], ["dif", "Dif"], ["comp", "Comp"],
  ["kg_u", "kg x U"], ["kg_total", "Kg Total GD"], ["precio_u", "$ x U"], ["precio_total", "$ Total GD"],
  ["contratista", "Contratistas"], ["movimiento", "Movimiento"], ["almacen", "Almacén"], ["n_venta", "N°Venta", true],
  ["cant_gd", "Cant:GD", true], ["gd_esval", "GD Esval", true], ["estado", "Estado", true], ["fecha", "Fecha"],
  ["dif_pend", "Dif.Pend"], ["gd_esval2", "GD Esval (2)", true], ["fecha_gd", "Fecha GD", true], ["observacion", "Observación", true],
];

export function nombreDescarga(ahora = new Date(), tipo = "completa") {
  const dia = String(ahora.getDate()).padStart(2, "0");
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const prefijo = tipo === "reservar" ? "VENTAS RESERVAR" : "VENTAS";
  return `${prefijo} ${dia}-${mes}-${ahora.getFullYear()}.xlsx`;
}

export function nombreDescargaAnual(anio, ahora = new Date(), tipo = "completa") {
  return nombreDescarga(ahora, tipo).replace(/^(VENTAS(?: RESERVAR)?) /, `$1 ANUAL ${anio} `);
}

async function leerJson(res, mensaje) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || mensaje);
  return data;
}

function Celda({ fila, campo, editando, valor, onCambio, onPegar, onPropagar }) {
  if (!editando) {
    // Texto normal: se puede seleccionar y copiar a Excel.
    return <span aria-label={`${campo} fila ${fila.pos}`}>{String(fila[campo] ?? "")}</span>;
  }
  return (
    <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      <input
        aria-label={`editar ${campo} fila ${fila.pos}`}
        value={valor}
        onChange={(e) => onCambio(fila, campo, e.target.value)}
        onPaste={(e) => {
          // Varias filas de una columna (copiadas de Excel) se reparten hacia abajo.
          if (onPegar(fila, campo, e.clipboardData.getData("text"))) e.preventDefault();
        }}
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key.toLowerCase() === "d") {
            e.preventDefault();
            onPropagar(fila, campo);
          }
        }}
        style={{ width: campo === "observacion" ? 160 : 80, padding: "2px 4px", border: "1px solid var(--borde)", borderRadius: 4 }}
      />
      <button
        type="button"
        aria-label={`copiar hacia abajo ${campo} fila ${fila.pos}`}
        title="Copiar este valor hacia abajo, hasta el final de la orden (Ctrl+D)"
        onClick={() => onPropagar(fila, campo)}
        style={{
          display: "inline-grid",
          placeItems: "center",
          width: 24,
          height: 24,
          padding: 0,
          border: "1px solid var(--borde)",
          background: "var(--superficie)",
          color: "var(--acento)",
          cursor: "pointer",
          boxShadow: "none",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14" />
          <path d="m6 12 6 6 6-6" />
        </svg>
      </button>
    </span>
  );
}
function Preview({ colores, recarga }) {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [planilla, setPlanilla] = useState({ filas: [], existe: false });
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [anioAnual, setAnioAnual] = useState(hoy.getFullYear());
  const [aniosConDatos, setAniosConDatos] = useState([]);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [borradores, setBorradores] = useState({});
  const [opcionDescarga, setOpcionDescarga] = useState(null);

  function cargar() {
    setCargando(true);
    return fetch(`/api/ventas/planilla?anio=${anio}&mes=${mes}`, { cache: "no-store" })
      .then((res) => leerJson(res, "No se pudo leer la planilla."))
      .then((data) => {
        setAviso("");
        setPlanilla(data);
      })
      .catch((e) => setAviso(e.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    fetch("/api/ventas/meses", { cache: "no-store" })
      .then((res) => leerJson(res, "No se pudieron leer los años."))
      .then((data) => setAniosConDatos([...new Set((data.meses || []).map((m) => m.anio))]))
      .catch(() => {});
  }, [recarga]);

  useEffect(() => {
    cargar();
  }, [anio, mes, recarga]);

  function cambiar(fila, campo, valor) {
    setBorradores((b) => ({ ...b, [fila.id]: { ...b[fila.id], [campo]: valor } }));
  }

  function pegar(fila, campo, texto) {
    const lineas = String(texto ?? "").replace(/\r/g, "").split("\n");
    if (lineas[lineas.length - 1] === "") lineas.pop();
    if (lineas.length < 2) return false;
    const visibles = ordenes.flatMap((o) => o.filas);
    const inicio = visibles.findIndex((f) => f.id === fila.id);
    if (inicio < 0) return false;
    setBorradores((b) => {
      const siguiente = { ...b };
      lineas.forEach((linea, i) => {
        const destino = visibles[inicio + i];
        if (destino) siguiente[destino.id] = { ...siguiente[destino.id], [campo]: linea.split("\t")[0].trim() };
      });
      return siguiente;
    });
    return true;
  }

  function propagar(fila, campo) {
    const grupo = ordenes.find((o) => o.filas.some((f) => f.id === fila.id));
    if (!grupo) return;
    const valor = borradores[fila.id]?.[campo] ?? String(fila[campo] ?? "");
    const debajo = grupo.filas.slice(grupo.filas.findIndex((f) => f.id === fila.id) + 1);
    setBorradores((b) => {
      const siguiente = { ...b };
      debajo.forEach((f) => {
        siguiente[f.id] = { ...siguiente[f.id], [campo]: valor };
      });
      return siguiente;
    });
  }

  async function alternarEdicion() {
    if (!editando) {
      setAviso("");
      setEditando(true);
      return;
    }
    const pendientes = Object.entries(borradores).flatMap(([id, campos]) => {
      const fila = planilla.filas.find((f) => String(f.id) === id);
      if (!fila) return [];
      const cambios = Object.fromEntries(Object.entries(campos).filter(([campo, valor]) => String(valor) !== String(fila[campo] ?? "")));
      return Object.keys(cambios).length ? [[id, cambios]] : [];
    });
    setGuardando(true);
    try {
      for (const [id, cambios] of pendientes) {
        const res = await fetch(`/api/ventas/filas/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cambios),
        });
        await leerJson(res, "No se pudo guardar la fila.");
      }
      setBorradores({});
      setEditando(false);
      setAviso(pendientes.length ? `Se guardaron los cambios de ${pendientes.length} filas.` : "");
      await cargar();
    } catch (e) {
      setAviso(e.message);
    } finally {
      setGuardando(false);
    }
  }
  function quitar(fila) {
    if (!window.confirm(`¿Quitar la fila ${fila.pos} (${fila.codigo}) de la planilla?`)) return;
    fetch(`/api/ventas/filas/${fila.id}`, { method: "DELETE" })
      .then((res) => leerJson(res, "No se pudo quitar la fila."))
      .then(() => cargar())
      .catch((e) => setAviso(e.message));
  }

  function quitarOrden(grupo) {
    const { fila } = grupo;
    if (!window.confirm(`¿Eliminar la orden completa (${grupo.filas.length} filas, ${fila.movimiento} N° ${fila.n_venta})?`)) return;
    fetch(`/api/ventas/ordenes/${planilla.id}/${fila.lote}`, { method: "DELETE" })
      .then((res) => leerJson(res, "No se pudo quitar la orden."))
      .then(() => cargar())
      .catch((e) => setAviso(e.message));
  }

  function descargar(anual = false, tipo = "completa") {
    setOpcionDescarga(null);
    const extra = tipo === "reservar" ? "&tipo=reservar" : "";
    const ruta = anual
      ? `/api/ventas/descargar-anual?anio=${anioAnual}&colores=${colores ? "1" : "0"}${extra}`
      : `/api/ventas/descargar?anio=${anio}&mes=${mes}&colores=${colores ? "1" : "0"}${extra}`;
    fetch(ruta)
      .then(async (res) => {
        if (!res.ok) await leerJson(res, "No se pudo descargar la planilla.");
        const url = URL.createObjectURL(await res.blob());
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = anual ? nombreDescargaAnual(anioAnual, new Date(), tipo) : nombreDescarga(new Date(), tipo);
        enlace.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => setAviso(e.message));
  }

  const texto = busqueda.trim().toLowerCase();
  const filas = texto
    ? planilla.filas.filter((f) => [f.codigo, f.descripcion, f.contratista, f.n_venta].some((v) => String(v ?? "").toLowerCase().includes(texto)))
    : planilla.filas;

  const porLote = new Map();
  filas.forEach((f) => {
    const clave = Number(f.lote);
    if (!porLote.has(clave)) porLote.set(clave, { fila: f, filas: [] });
    porLote.get(clave).filas.push(f);
  });
  const ordenes = [...porLote.values()].sort((a, b) => Number(a.fila.lote) - Number(b.fila.lote));

  return (
    <section data-tour="ventas-preview" style={{ background: "var(--superficie)", borderRadius: 8, padding: 16, margin: "0 auto 16px", maxWidth: "100%", width: "100%", boxSizing: "border-box" }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 18, textAlign: "center" }}>Planilla de ventas</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <label data-tour="ventas-mes" style={{ fontSize: 14 }}>
          Mes{" "}
          <input
            type="month"
            aria-label="Mes de la planilla"
            value={`${anio}-${String(mes).padStart(2, "0")}`}
            onChange={(e) => {
              const [a, m] = e.target.value.split("-").map(Number);
              if (a && m) {
                setAnio(a);
                setMes(m);
              }
            }}
            style={CAMPO}
          />
        </label>
        <input aria-label="Filtrar filas" placeholder="Filtrar código, descripción..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ ...CAMPO, flex: 1, minWidth: 160 }} />
        <button
          type="button"
          onClick={alternarEdicion}
          disabled={!planilla.existe || guardando}
          style={{ padding: "8px 14px", border: "1px solid var(--borde)", borderRadius: 6, background: "var(--superficie)", color: "var(--texto)", cursor: "pointer" }}
        >
          {guardando ? "Guardando..." : editando ? "Guardar" : "Editar"}
        </button>
        <button
          data-tour="ventas-descargar"
          type="button"
          onClick={() => setOpcionDescarga({ anual: false })}
          disabled={!planilla.existe}
          style={{ padding: "8px 14px", border: 0, borderRadius: 6, background: "var(--acento)", color: "var(--sobre)", cursor: "pointer" }}
        >
          Descargar Excel
        </button>
        <span data-tour="ventas-anual" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <select
            aria-label="Año de la planilla anual"
            value={anioAnual}
            onChange={(e) => setAnioAnual(Number(e.target.value))}
            style={CAMPO}
          >
            {[...new Set([hoy.getFullYear(), anioAnual, ...aniosConDatos])].sort((a, b) => b - a).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button
            type="button"
            title={`Une todas las planillas existentes de ${anioAnual} (enero a diciembre) en un solo archivo`}
            onClick={() => setOpcionDescarga({ anual: true })}
            style={{ padding: "8px 14px", border: 0, borderRadius: 6, background: "var(--acento)", color: "var(--sobre)", cursor: "pointer" }}
          >
            Descargar planilla anual
          </button>
        </span>
      </div>
      {opcionDescarga && (
        <div
          role="dialog"
          aria-label="Elegir tipo de planilla"
          style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 80 }}
        >
          <div style={{ width: "min(420px, 100%)", background: "var(--superficie)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>¿Qué planilla quieres descargar?</h3>
            <button
              type="button"
              onClick={() => descargar(opcionDescarga.anual, "completa")}
              style={{ padding: "10px 14px", border: 0, borderRadius: 6, background: "var(--acento)", color: "var(--sobre)", cursor: "pointer" }}
            >
              Descargar planilla completa
            </button>
            <button
              type="button"
              onClick={() => descargar(opcionDescarga.anual, "reservar")}
              style={{ padding: "10px 14px", border: 0, borderRadius: 6, background: "var(--acento)", color: "var(--sobre)", cursor: "pointer" }}
            >
              Descargar planilla para reservar material
            </button>
            <button
              type="button"
              onClick={() => setOpcionDescarga(null)}
              style={{ padding: "10px 14px", border: "1px solid var(--borde)", borderRadius: 6, background: "var(--superficie)", color: "var(--texto)", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {aviso && <p style={{ margin: "0 0 8px" }}>{aviso}</p>}
      {cargando && <p style={{ margin: 0 }}>Cargando planilla...</p>}
      {!cargando && !planilla.existe && <p style={{ margin: 0 }}>No hay planilla de {MESES[mes - 1]} {anio}.</p>}
      {planilla.existe && (
        <div style={{ overflow: "auto", maxHeight: "60vh" }}>
          <Planilla style={{ width: "auto", fontSize: 13 }}>
            <thead>
              <tr>
                <th data-sin-copia="1" style={TH}>N°</th>
                {COLUMNAS.map(([clave, titulo]) => <th key={clave} style={TH}>{titulo}</th>)}
                <th data-sin-copia="1" style={TH}></th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((grupo) => (
                <Fragment key={grupo.fila.lote}>
                  <tr data-sin-copia="1">
                    <td colSpan={COLUMNAS.length + 2} style={{ ...TD, background: "var(--acento)", color: "var(--sobre)", fontWeight: 700 }}>
                      Orden: {grupo.fila.movimiento} N° {grupo.fila.n_venta} · {grupo.fila.contratista} · {grupo.fila.fecha} ({grupo.filas.length} filas){" "}
                      <button
                        type="button"
                        title="Eliminar la orden completa"
                        onClick={() => quitarOrden(grupo)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          marginLeft: 8,
                          padding: "3px 10px",
                          border: "1px solid var(--borde)",
                          background: "var(--superficie)",
                          color: "var(--peligro, #dc2626)",
                          fontSize: 12,
                          cursor: "pointer",
                          boxShadow: "none",
                          verticalAlign: "middle",
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 7h16" />
                          <path d="M9 7V4h6v3" />
                          <path d="M6 7l1 13h10l1-13" />
                          <path d="M10 11v5M14 11v5" />
                        </svg>
                        <span>Eliminar orden</span>
                      </button>
                    </td>
                  </tr>
                  {grupo.filas.map((fila, i) => (
                    <tr key={fila.id} style={{ color: colores && fila.rojo ? "#d00" : undefined, fontWeight: 600 }}>
                      <td data-sin-copia="1" style={TD}>{(i + 1) * 10}</td>
                      {COLUMNAS.map(([clave, , editable]) => (
                        <td key={clave} style={TD}>
                          {editable ? <Celda fila={fila} campo={clave} editando={editando} valor={borradores[fila.id]?.[clave] ?? String(fila[clave] ?? "")} onCambio={cambiar} onPegar={pegar} onPropagar={propagar} /> : String(fila[clave] ?? "")}
                        </td>
                      ))}
                      <td data-sin-copia="1" style={TD}>
                        <button
                          type="button"
                          aria-label={`Quitar fila ${fila.pos}`}
                          title="Quitar fila"
                          onClick={() => quitar(fila)}
                          style={{
                            display: "inline-grid",
                            placeItems: "center",
                            width: 24,
                            height: 24,
                            padding: 0,
                            border: "1px solid var(--borde)",
                            background: "var(--superficie)",
                            color: "var(--peligro, #dc2626)",
                            cursor: "pointer",
                            boxShadow: "none",
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 7h16" />
                            <path d="M9 7V4h6v3" />
                            <path d="M6 7l1 13h10l1-13" />
                            <path d="M10 11v5M14 11v5" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </Planilla>
          {filas.length === 0 && <p>Sin filas para mostrar.</p>}
        </div>
      )}
    </section>
  );
}

export default function Ventas({ colores = true, listaContratistas = [], onSinGuardar }) {
  const [orden, setOrden] = useState(null);
  const [contratista, setContratista] = useState("1");
  const [movimiento, setMovimiento] = useState("1");
  const [modo, setModo] = useState("orden");
  const [productos, setProductos] = useState([{ codigo: "", cantidad: "" }]);
  const [codVenta, setCodVenta] = useState("");
  const [almacen, setAlmacen] = useState("M501");
  const [procesando, setProcesando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const archivoActual = useRef(null);
  const [hojas, setHojas] = useState([]);
  const [hoja, setHoja] = useState("");

  function elegirArchivo(archivo) {
    setOrden(archivo);
    setHojas([]);
    setHoja("");
    setAviso("");
    archivoActual.current = archivo;
    if (!archivo) return;
    const cuerpo = new FormData();
    cuerpo.append("archivo", archivo);
    fetch("/api/ventas/hojas", { method: "POST", body: cuerpo })
      .then((res) => leerJson(res, "No se pudieron leer las hojas del archivo."))
      .then((data) => {
        if (archivoActual.current !== archivo) return;
        const lista = data.hojas || [];
        setHojas(lista);
        setHoja(lista[data.activa] ?? lista[0] ?? "");
      })
      .catch((err) => {
        if (archivoActual.current === archivo) setAviso(err.message);
      });
  }

  // Pega una columna copiada de Excel: reparte los valores hacia abajo y crea las filas que falten.
  function pegarColumna(indice, campo, texto) {
    const lineas = String(texto ?? "").replace(/\r/g, "").split("\n");
    if (lineas[lineas.length - 1] === "") lineas.pop();
    if (lineas.length < 2) return false;
    if (lineas.length > 500) {
      setAviso("Se pueden pegar hasta 500 filas a la vez.");
      return true;
    }
    setProductos((actual) => {
      const siguiente = actual.map((f) => ({ ...f }));
      lineas.forEach((linea, i) => {
        while (siguiente.length <= indice + i) siguiente.push({ codigo: "", cantidad: "" });
        siguiente[indice + i][campo] = linea.split("\t")[0].trim();
      });
      return siguiente;
    });
    return true;
  }
  useEffect(() => {
    const indice = Number(contratista);
    if (listaContratistas.length && !(indice >= 1 && indice <= listaContratistas.length + 1)) setContratista("1");
  }, [listaContratistas]);

  const sinGuardar = Boolean(
    orden ||
      modo !== "orden" ||
      productos.some((f) => String(f.codigo).trim() || String(f.cantidad).trim()) ||
      movimiento !== "1" ||
      contratista !== "1" ||
      (movimiento === "2" && almacen !== "M501") ||
      String(codVenta).trim() !== ""
  );
  useEffect(() => {
    onSinGuardar?.(sinGuardar);
  }, [sinGuardar]);

  function reiniciar() {
    setOrden(null);
    setHojas([]);
    setHoja("");
    setContratista("1");
    setMovimiento("1");
    setModo("orden");
    setProductos([{ codigo: "", cantidad: "" }]);
    setCodVenta("");
    setAlmacen("M501");
    setFormKey((k) => k + 1);
  }

  function enviar(event) {
    event.preventDefault();
    const validos = productos.filter((f) => String(f.codigo).trim() && String(f.cantidad).trim());
    if (modo === "manual") {
      if (validos.length === 0) return setAviso("Agrega al menos un producto con código y cantidad.");
    } else if (!orden) {
      return setAviso(movimiento === "2" ? "Elige el archivo de traspaso." : "Elige el archivo de orden de venta.");
    }
    setAviso("");
    setProcesando(true);
    const cuerpo = new FormData();
    cuerpo.append("modo", modo);
    if (modo === "manual") cuerpo.append("items", JSON.stringify(validos));
    else {
      cuerpo.append("orden", orden);
      if (hoja) cuerpo.append("hoja", hoja);
    }
    cuerpo.append("contratista", contratista);
    cuerpo.append("movimiento", movimiento);
    cuerpo.append("almacen", movimiento === "2" ? almacen : "M501");
    cuerpo.append("codVenta", movimiento === "2" && modo !== "manual" ? "n/a" : codVenta);
    fetch("/api/ventas", { method: "POST", body: cuerpo })
      .then((res) => leerJson(res, "No se pudo guardar la venta."))
      .then((data) => {
        reiniciar();
        setRecarga((r) => r + 1);
        setAviso(`Se agregaron ${data.agregadas} filas a la planilla de ${MESES[data.mes - 1]} ${data.anio}.`);
      })
      .catch((err) => setAviso(err.message))
      .finally(() => setProcesando(false));
  }

  return (
    <>
      <section style={{ background: "var(--superficie)", borderRadius: 8, padding: 16, margin: "0 auto 16px", maxWidth: 760, width: "100%", boxSizing: "border-box" }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, textAlign: "center" }}>Añadir venta</h2>
        <form key={formKey} onSubmit={enviar} style={{ display: "grid", gap: 12 }}>
          <label style={ETIQUETA}>
            Cómo cargar los productos
            <select value={modo} onChange={(e) => setModo(e.target.value)} style={CAMPO}>
              <option value="orden">Desde archivo (orden o traspaso)</option>
              <option value="manual">Producto a producto</option>
            </select>
          </label>
          {modo === "orden" ? (
            <label style={ETIQUETA}>
              {movimiento === "2" ? "Archivo de traspaso" : "Archivo de orden de venta"}
              <input type="file" accept=".xlsx" onChange={(e) => elegirArchivo(e.target.files?.[0] || null)} />
              {hojas.length > 0 && (
                <span style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 13 }}>
                    El archivo tiene {hojas.length} {hojas.length === 1 ? "hoja" : "hojas"}. ¿En cuál se trabaja?
                  </span>
                  <select aria-label="Hoja del archivo" value={hoja} onChange={(e) => setHoja(e.target.value)} style={CAMPO}>
                    {hojas.map((nombre) => <option key={nombre} value={nombre}>{nombre}</option>)}
                  </select>
                </span>
              )}
              <span style={{ fontSize: 12, color: "var(--texto-suave, #666)" }}>
                {movimiento === "2"
                  ? "Encabezados en la fila 3. El número se toma del título en C1. Código, descripción, medida, solicitado, entregar y CONCON se copian a la planilla."
                  : "Se lee la hoja de pedido: código, unidad y solicitado."}
              </span>
            </label>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 14 }}>Productos</span>
              {productos.map((fila, indice) => (
                <div key={indice} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ minWidth: 24, textAlign: "right", fontSize: 13 }}>{indice + 1}</span>
                  <input
                    value={fila.codigo}
                    placeholder="Código"
                    onChange={(e) => setProductos(productos.map((f, i) => (i === indice ? { ...f, codigo: e.target.value } : f)))}
                    onPaste={(e) => {
                      if (pegarColumna(indice, "codigo", e.clipboardData.getData("text"))) e.preventDefault();
                    }}
                    style={{ ...CAMPO, flex: 2, minWidth: 0, boxSizing: "border-box" }}
                  />
                  <input
                    value={fila.cantidad}
                    placeholder="Cantidad"
                    inputMode="numeric"
                    onChange={(e) => setProductos(productos.map((f, i) => (i === indice ? { ...f, cantidad: e.target.value } : f)))}
                    onPaste={(e) => {
                      if (pegarColumna(indice, "cantidad", e.clipboardData.getData("text"))) e.preventDefault();
                    }}
                    style={{ ...CAMPO, flex: 1, minWidth: 0, boxSizing: "border-box" }}
                  />
                  <input
                    value={fila.med ?? ""}
                    placeholder="Med"
                    aria-label={`Med producto ${indice + 1}`}
                    onChange={(e) => setProductos(productos.map((f, i) => (i === indice ? { ...f, med: e.target.value } : f)))}
                    onPaste={(e) => {
                      if (pegarColumna(indice, "med", e.clipboardData.getData("text"))) e.preventDefault();
                    }}
                    style={{ ...CAMPO, flex: 1, minWidth: 0, boxSizing: "border-box" }}
                  />
                  <button
                    type="button"
                    aria-label="Quitar producto"
                    title="Quitar producto"
                    onClick={() => setProductos(productos.filter((_, i) => i !== indice))}
                    style={{
                      display: "inline-grid",
                      placeItems: "center",
                      width: 36,
                      flexShrink: 0,
                      padding: 0,
                      border: "1px solid var(--borde)",
                      background: "var(--superficie)",
                      color: "var(--peligro, #dc2626)",
                      cursor: "pointer",
                      boxShadow: "none",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 7h16" />
                      <path d="M9 7V4h6v3" />
                      <path d="M6 7l1 13h10l1-13" />
                      <path d="M10 11v5M14 11v5" />
                    </svg>
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setProductos([...productos, { codigo: "", cantidad: "" }])} style={{ padding: "8px 14px", border: "1px solid var(--borde)", borderRadius: 6, background: "var(--superficie)", color: "var(--texto)", cursor: "pointer", justifySelf: "start" }}>
                + Agregar producto
              </button>
            </div>
          )}
          <label style={ETIQUETA}>
            Contratista
            <select value={contratista} onChange={(e) => setContratista(e.target.value)} style={CAMPO}>
              {listaContratistas.map((nombre, indice) => (
                <option key={nombre} value={String(indice + 1)}>{nombre}</option>
              ))}
              <option value={String(listaContratistas.length + 1)}>n/a</option>
            </select>
          </label>
          <label style={ETIQUETA}>
            Tipo de movimiento
            <select value={movimiento} onChange={(e) => setMovimiento(e.target.value)} style={CAMPO}>
              <option value="1">Venta</option>
              <option value="2">Traspaso</option>
            </select>
          </label>
          {(movimiento === "1" || (movimiento === "2" && modo === "manual")) && (
            <label style={ETIQUETA}>
              Número de venta
              <input value={codVenta} placeholder="Ej: 12345" onChange={(e) => setCodVenta(e.target.value)} style={CAMPO} />
            </label>
          )}
          {movimiento === "2" && (
            <label style={ETIQUETA}>
              Almacén
              <select value={almacen} onChange={(e) => setAlmacen(e.target.value)} style={CAMPO}>
                {["M501", "M502", "M503", "M504", "M505"].map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
          )}
          <button
            type="submit"
            disabled={procesando}
            style={{ padding: "8px 14px", border: 0, borderRadius: 6, background: "var(--acento)", color: "var(--sobre)", cursor: "pointer", justifySelf: "center" }}
          >
            {procesando ? "Guardando..." : "Guardar en la planilla"}
          </button>
          {aviso && <p style={{ margin: 0 }}>{aviso}</p>}
        </form>
      </section>
      <Preview colores={colores} recarga={recarga} />
    </>
  );
}
