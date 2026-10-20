import { useEffect, useRef, useState } from "react";
import Navbar from "./Navbar.jsx";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const CLAVE_GUARDADO = "gastosPendientes";
const VACIO = { topico: "", proveedor: "", nboleta: "", fecha: "", monto: "" };

const boton = {
  padding: "8px 14px",
  border: 0,
  borderRadius: 6,
  background: "var(--boton)",
  color: "var(--sobre)",
  fontSize: 14,
  cursor: "pointer",
};

function leerGuardados() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_GUARDADO) || "[]");
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
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
  const [mes, setMes] = useState(MESES[new Date().getMonth()]);
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

  function cambiar(campo) {
    return (event) => setForm((anterior) => ({ ...anterior, [campo]: event.target.value }));
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

  const campo = { padding: "8px 12px", borderRadius: 6, fontSize: 14, boxSizing: "border-box" };

  return (
    <div style={{ padding: 16 }}>
      <Navbar />
      <h2 style={{ marginTop: 0 }}>Planilla de gastos</h2>
      <form onSubmit={agregar} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <select aria-label="Tópico" value={form.topico} onChange={cambiar("topico")} style={campo}>
          <option value="">Tópico</option>
          {topicos.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input aria-label="Proveedor" placeholder="Proveedor" value={form.proveedor} onChange={cambiar("proveedor")} style={campo} />
        <input aria-label="N° Boleta" placeholder="N° Boleta" value={form.nboleta} onChange={cambiar("nboleta")} style={campo} />
        <input aria-label="Fecha Boleta" placeholder="Fecha (dd-mm-aaaa)" value={form.fecha} onChange={cambiar("fecha")} style={campo} />
        <input aria-label="Monto" placeholder="Monto" inputMode="numeric" value={form.monto} onChange={cambiar("monto")} style={campo} />
        <button type="submit" style={boton}>Agregar</button>
      </form>

      {error && <p role="alert" style={{ color: "#d32f2f" }}>{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Tópico", "Proveedor", "N° Boleta", "Fecha Boleta", "Monto", ""].map((c) => (
                <th key={c || "acciones"} style={{ textAlign: "left", padding: 6, borderBottom: "1px solid var(--borde)" }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gastos.map((g, i) => (
              <tr key={`${g.nboleta}-${i}`}>
                <td style={{ padding: 6 }}>{g.topico}</td>
                <td style={{ padding: 6 }}>{g.proveedor}</td>
                <td style={{ padding: 6 }}>{g.nboleta}</td>
                <td style={{ padding: 6 }}>{g.fecha}</td>
                <td style={{ padding: 6 }}>{g.monto}</td>
                <td style={{ padding: 6 }}>
                  <button type="button" aria-label={`Quitar fila ${i + 1}`} onClick={() => quitar(i)} style={{ ...boton, padding: "2px 8px" }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16, alignItems: "center" }}>
        <button type="button" style={boton} onClick={guardar}>Guardar Datos</button>
        <button type="button" style={boton} onClick={() => archivo.current?.click()}>Recuperar Datos</button>
        <input ref={archivo} type="file" accept=".xlsx" onChange={recuperar} hidden data-testid="archivo-gastos" />
        <select aria-label="Mes" value={mes} onChange={(e) => setMes(e.target.value)} style={campo}>
          {MESES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <button type="button" style={boton} onClick={procesar}>Procesar Datos</button>
        <button type="button" style={{ ...boton, background: "#d32f2f" }} onClick={() => setGastos([])}>Vaciar</button>
      </div>
    </div>
  );
}
