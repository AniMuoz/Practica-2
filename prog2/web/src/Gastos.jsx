import { useEffect, useRef, useState } from "react";
import Navbar from "./Navbar.jsx";
import Planilla from "./Planilla.jsx";

const CLAVE_GUARDADO = "gastosPendientes";
const VACIO = { topico: "", proveedor: "", nboleta: "", fecha: "", monto: "" };
const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const boton = {
  padding: "8px 14px",
  border: 0,
  borderRadius: 6,
  background: "var(--boton)",
  color: "var(--sobre)",
  fontSize: 14,
  cursor: "pointer",
};

const campo = { padding: "8px 12px", borderRadius: 6, fontSize: 14, boxSizing: "border-box" };
// Campos del formulario: se encogen para que la fila entre completa sin scroll.
const campoFila = { ...campo, flex: "1 1 0", minWidth: 0, padding: "8px 6px" };

function mesActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

function leerGuardados() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_GUARDADO) || "[]");
    return Array.isArray(datos) ? datos.filter((g) => g && ES_FECHA.test(g.fecha)) : [];
  } catch {
    return [];
  }
}

function fechaLegible(iso) {
  return ES_FECHA.test(iso) ? iso.split("-").reverse().join("/") : iso;
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function nombreDeCabecera(res, respaldo) {
  const texto = res.headers.get("Content-Disposition") || "";
  const m = /filename=([^;]+)/.exec(texto);
  return m ? decodeURIComponent(m[1]) : respaldo;
}

export default function Gastos() {
  const [topicos, setTopicos] = useState([]);
  const [gastos, setGastos] = useState(leerGuardados);
  const [form, setForm] = useState(VACIO);
  const [mes, setMes] = useState(mesActual);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const archivo = useRef(null);

  useEffect(() => {
    fetch("/api/gastos/topicos")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setTopicos(data.topicos || []))
      .catch(() => setError("No se pudieron cargar los tópicos."));
  }, []);

  useEffect(() => {
    localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(gastos));
  }, [gastos]);

  function aviso(texto, esError = false) {
    setMensaje(esError ? "" : texto);
    setError(esError ? texto : "");
  }

  function cambiar(nombre) {
    return (event) => setForm((anterior) => ({ ...anterior, [nombre]: event.target.value }));
  }

  function agregar(event) {
    event.preventDefault();
    const limpio = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
    if (Object.values(limpio).some((v) => !v)) {
      aviso("Debe completar todos los campos.", true);
      return;
    }
    if (!/^-?\d+$/.test(limpio.monto)) {
      aviso("El monto debe ser un número entero.", true);
      return;
    }
    setGastos((anterior) => [...anterior, limpio]);
    setForm(VACIO);
    aviso("");
  }

  function quitar(indice) {
    setGastos((anterior) => anterior.filter((_, i) => i !== indice));
  }

  async function pedirArchivo(ruta, cuerpo, respaldo) {
    const res = await fetch(ruta, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "No se pudo completar la operación.");
    }
    descargar(await res.blob(), nombreDeCabecera(res, respaldo));
  }

  async function guardar() {
    if (!gastos.length) return aviso("No hay datos para guardar.", true);
    try {
      await pedirArchivo("/api/gastos/guardar", { gastos }, "Datos_guardados_no_procesados.xlsx");
      aviso("Datos guardados.");
    } catch (e) {
      aviso(e.message, true);
    }
    return undefined;
  }

  async function procesar() {
    if (!gastos.length) return aviso("No hay datos para procesar.", true);
    if (!mes) return aviso("Seleccione el mes para procesar los datos.", true);
    try {
      await pedirArchivo("/api/gastos/procesar", { gastos, mes }, "Detalle_gastos.xlsx");
      aviso("Planilla generada.");
    } catch (e) {
      aviso(e.message, true);
    }
    return undefined;
  }

  async function recuperar(event) {
    const elegido = event.target.files?.[0];
    event.target.value = "";
    if (!elegido) return;
    const datos = new FormData();
    datos.append("archivo", elegido);
    try {
      const res = await fetch("/api/gastos/recuperar", { method: "POST", body: datos });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo recuperar el archivo.");
      setGastos((anterior) => [...anterior, ...data.gastos]);
      aviso("Datos recuperados con éxito.");
    } catch (e) {
      aviso(e.message, true);
    }
  }

  const columnas = ["Tópico", "Proveedor", "N° Boleta", "Fecha Boleta", "Monto", ""];

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
      <div style={{ maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ margin: "0 0 16px", fontSize: 22 }}>Planilla de gastos</h1>
        <form onSubmit={agregar} style={{ display: "flex", flexWrap: "nowrap", justifyContent: "center", gap: 8, marginBottom: 16 }}>
          <select aria-label="Tópico" value={form.topico} onChange={cambiar("topico")} style={campoFila}>
            <option value="">Tópico</option>
            {topicos.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input aria-label="Proveedor" placeholder="Proveedor" value={form.proveedor} onChange={cambiar("proveedor")} style={campoFila} />
          <input aria-label="N° Boleta" placeholder="N° Boleta" value={form.nboleta} onChange={cambiar("nboleta")} style={campoFila} />
          <input aria-label="Fecha Boleta" type="date" value={form.fecha} onChange={cambiar("fecha")} style={campoFila} />
          <input aria-label="Monto" placeholder="Monto" inputMode="numeric" value={form.monto} onChange={cambiar("monto")} style={campoFila} />
          <button type="submit" style={{ ...boton, flexShrink: 0 }}>Agregar</button>
        </form>

        {error && <p role="alert" style={{ color: "var(--peligro)" }}>{error}</p>}
        {mensaje && <p role="status">{mensaje}</p>}

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <button type="button" style={boton} onClick={guardar}>Guardar Datos sin procesar</button>
          <button type="button" style={boton} onClick={() => archivo.current?.click()}>Recuperar Datos</button>
          <input ref={archivo} type="file" accept=".xlsx" onChange={recuperar} hidden data-testid="archivo-gastos" />
          <input aria-label="Mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={campo} />
          <button type="button" style={boton} onClick={procesar}>Procesar Datos</button>
          <button type="button" style={{ ...boton, background: "var(--peligro)" }} onClick={() => setGastos([])}>Vaciar</button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <Planilla style={{ textAlign: "center" }}>
            <thead>
              <tr>
                {columnas.map((c, i) => (
                  <th
                    key={c || `acciones-${i}`}
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      textAlign: "center",
                      padding: "10px 12px",
                      borderBottom: "2px solid var(--borde)",
                      background: "var(--encabezado)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gastos.map((g, i) => (
                <tr key={`${g.nboleta}-${i}`}>
                  {[g.topico, g.proveedor, g.nboleta, fechaLegible(g.fecha), g.monto].map((valor, j) => (
                    <td key={columnas[j]} style={{ padding: "8px 12px", borderBottom: "1px solid var(--borde-suave)", whiteSpace: "nowrap" }}>
                      {valor}
                    </td>
                  ))}
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--borde-suave)" }}>
                    <button type="button" aria-label={`Quitar fila ${i + 1}`} onClick={() => quitar(i)} style={{ ...boton, padding: "2px 8px", background: "var(--peligro)" }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Planilla>
        </div>
      </div>
    </main>
  );
}
