import { Fragment, useEffect, useState } from "react";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const CAMPO = { padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6 };
const ETIQUETA = { display: "grid", gap: 4, fontSize: 14 };
const TH = { padding: "6px 8px", textAlign: "left", background: "var(--superficie)", borderBottom: "2px solid var(--borde)", whiteSpace: "nowrap", position: "sticky", top: 0 };
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

export function nombreDescarga(ahora = new Date()) {
  const dia = String(ahora.getDate()).padStart(2, "0");
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  return `VENTAS ${dia}-${mes}-${ahora.getFullYear()}.xlsx`;
}

async function leerJson(res, mensaje) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || mensaje);
  return data;
}

function Celda({ fila, campo, onGuardar }) {
  const [valor, setValor] = useState(String(fila[campo] ?? ""));
  useEffect(() => setValor(String(fila[campo] ?? "")), [fila, campo]);
  return (
    <input
      aria-label={`${campo} fila ${fila.pos}`}
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      onBlur={() => valor !== String(fila[campo] ?? "") && onGuardar(fila, campo, valor)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      style={{ width: campo === "observacion" ? 160 : 80, padding: "2px 4px", border: "1px solid var(--borde)", borderRadius: 4 }}
    />
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
    cargar();
  }, [anio, mes, recarga]);

  function guardar(fila, campo, valor) {
    fetch(`/api/ventas/filas/${fila.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [campo]: valor }),
    })
      .then((res) => leerJson(res, "No se pudo guardar la fila."))
      .then(({ fila: nueva }) => {
        setAviso("");
        setPlanilla((p) => ({ ...p, filas: p.filas.map((f) => (f.id === nueva.id ? { ...f, ...nueva, pos: f.pos, lote: f.lote } : f)) }));
      })
      .catch((e) => {
        setAviso(e.message);
        cargar();
      });
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

  function descargar() {
    fetch(`/api/ventas/descargar?anio=${anio}&mes=${mes}&colores=${colores ? "1" : "0"}`)
      .then(async (res) => {
        if (!res.ok) await leerJson(res, "No se pudo descargar la planilla.");
        const url = URL.createObjectURL(await res.blob());
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = nombreDescarga();
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
          data-tour="ventas-descargar"
          type="button"
          onClick={descargar}
          disabled={!planilla.existe}
          style={{ padding: "8px 14px", border: 0, borderRadius: 6, background: "var(--acento)", color: "var(--sobre)", cursor: "pointer" }}
        >
          Descargar Excel
        </button>
      </div>
      {aviso && <p style={{ margin: "0 0 8px" }}>{aviso}</p>}
      {cargando && <p style={{ margin: 0 }}>Cargando planilla...</p>}
      {!cargando && !planilla.existe && <p style={{ margin: 0 }}>No hay planilla de {MESES[mes - 1]} {anio}.</p>}
      {planilla.existe && (
        <div style={{ overflow: "auto", maxHeight: "60vh" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {COLUMNAS.map(([clave, titulo]) => <th key={clave} style={TH}>{titulo}</th>)}
                <th style={TH}></th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((grupo) => (
                <Fragment key={grupo.fila.lote}>
                  <tr>
                    <td colSpan={COLUMNAS.length + 1} style={{ ...TD, background: "var(--superficie)", fontWeight: 700 }}>
                      Orden: {grupo.fila.movimiento} N° {grupo.fila.n_venta} · {grupo.fila.contratista} · {grupo.fila.fecha} ({grupo.filas.length} filas){" "}
                      <button type="button" onClick={() => quitarOrden(grupo)}>Eliminar orden</button>
                    </td>
                  </tr>
                  {grupo.filas.map((fila) => (
                    <tr key={fila.id} style={{ color: colores && fila.rojo ? "#d00" : undefined, fontWeight: 600 }}>
                      {COLUMNAS.map(([clave, , editable]) => (
                        <td key={clave} style={TD}>
                          {editable ? <Celda fila={fila} campo={clave} onGuardar={guardar} /> : String(fila[clave] ?? "")}
                        </td>
                      ))}
                      <td style={TD}><button type="button" onClick={() => quitar(fila)}>Quitar</button></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
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
    else cuerpo.append("orden", orden);
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
      <section style={{ background: "var(--superficie)", borderRadius: 8, padding: 16, margin: "0 auto 16px", maxWidth: 640, width: "100%" }}>
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
              <input type="file" accept=".xlsx" onChange={(e) => setOrden(e.target.files?.[0] || null)} />
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
                <div key={indice} style={{ display: "flex", gap: 8 }}>
                  <input
                    value={fila.codigo}
                    placeholder="Código"
                    onChange={(e) => setProductos(productos.map((f, i) => (i === indice ? { ...f, codigo: e.target.value } : f)))}
                    style={{ ...CAMPO, flex: 2 }}
                  />
                  <input
                    value={fila.cantidad}
                    placeholder="Cantidad"
                    inputMode="numeric"
                    onChange={(e) => setProductos(productos.map((f, i) => (i === indice ? { ...f, cantidad: e.target.value } : f)))}
                    style={{ ...CAMPO, flex: 1 }}
                  />
                  <button type="button" onClick={() => setProductos(productos.filter((_, i) => i !== indice))} style={{ padding: "8px 10px" }}>Quitar</button>
                </div>
              ))}
              <button type="button" onClick={() => setProductos([...productos, { codigo: "", cantidad: "" }])} style={{ padding: "6px 12px", justifySelf: "start" }}>
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
