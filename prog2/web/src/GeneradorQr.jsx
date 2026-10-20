import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSesion } from "./Acceso.jsx";
import FiltrosTabla, { FILTROS_INICIALES } from "./FiltrosTabla.jsx";
import Navbar from "./Navbar.jsx";
import { crearQrPng, sinQr } from "./generarQr.js";
import { filtrarFilas } from "./reglasPlanilla.js";

const boton = {
  padding: "8px 14px",
  border: 0,
  borderRadius: 6,
  background: "var(--boton)",
  color: "var(--sobre)",
  fontSize: 14,
  cursor: "pointer",
};

export default function GeneradorQr() {
  const { rol } = useSesion();
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [clave, setClave] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState("");
  const cancelar = useRef(false);

  function cargar() {
    return fetch("/api/tabla", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setFilas(data.filas || []))
      .catch(() => setError("No se pudo cargar la tabla."));
  }

  useEffect(() => {
    if (rol === "admin") cargar();
  }, [rol]);

  const filtradas = useMemo(() => filtrarFilas(filas, filtros), [filas, filtros]);
  const pendientes = useMemo(() => sinQr(filtradas), [filtradas]);

  if (rol !== "admin") return <Navigate to="/" replace />;

  async function generarYSubir() {
    if (!clave) return setAviso("Escribe la contraseña de datos.");
    if (!pendientes.length) return setAviso("No hay filas sin QR con estos filtros.");
    if (!window.confirm(`¿Generar y subir ${pendientes.length} QR a las filas que no tienen uno?`)) return;
    cancelar.current = false;
    setTrabajando(true);
    let ok = 0;
    const fallidos = [];
    for (let i = 0; i < pendientes.length; i++) {
      if (cancelar.current) break;
      const codigo = String(pendientes[i].Codigo);
      setAviso(`Subiendo ${i + 1} de ${pendientes.length}...`);
      try {
        const blob = await crearQrPng(codigo);
        const cuerpo = new FormData();
        cuerpo.append("clave", clave);
        cuerpo.append("campo", "QR");
        cuerpo.append("archivo", new File([blob], `qr_${codigo}.png`, { type: "image/png" }));
        const res = await fetch(`/api/material/${encodeURIComponent(codigo)}/imagen`, { method: "POST", body: cuerpo });
        if (!res.ok) throw new Error();
        ok++;
      } catch {
        fallidos.push(codigo);
      }
    }
    const f = fallidos.length
      ? `, ${fallidos.length} fallidos (${fallidos.slice(0, 10).join(", ")}${fallidos.length > 10 ? "..." : ""})`
      : "";
    setAviso(`${cancelar.current ? "Cancelado" : "Listo"}: ${ok} QR subidos${f}.`);
    setTrabajando(false);
    cargar();
  }

  async function descargarZip() {
    if (!filtradas.length) return setAviso("No hay filas con estos filtros.");
    setTrabajando(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (let i = 0; i < filtradas.length; i++) {
        const codigo = String(filtradas[i].Codigo);
        setAviso(`Generando ${i + 1} de ${filtradas.length}...`);
        zip.file(`qr_${codigo}.png`, await crearQrPng(codigo));
      }
      const url = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "qr_materiales.zip";
      a.click();
      URL.revokeObjectURL(url);
      setAviso(`ZIP con ${filtradas.length} QR descargado.`);
    } catch {
      setAviso("No se pudo generar el ZIP.");
    }
    setTrabajando(false);
  }

  return (
    <main style={{ minHeight: "100vh", boxSizing: "border-box", margin: 0, padding: 16, fontFamily: "Segoe UI, sans-serif", background: "var(--fondo)", color: "var(--texto)" }}>
      <Navbar />
      <h1 style={{ margin: "0 0 16px", fontSize: 22 }}>Generador de QR</h1>
      {error && <p style={{ color: "var(--peligro)" }}>{error}</p>}
      <FiltrosTabla filas={filas} filtros={filtros} onChange={setFiltros} />
      <p style={{ fontSize: 14 }}>
        Cumplen el filtro: {filtradas.length}. Con QR: {filtradas.length - pendientes.length}. Sin QR: {pendientes.length}.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="password"
          placeholder="Contraseña de datos"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          style={{ padding: "8px 10px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
        />
        <button type="button" style={boton} disabled={trabajando} onClick={generarYSubir}>
          Generar y subir QR nuevos
        </button>
        <button type="button" style={boton} disabled={trabajando} onClick={descargarZip}>
          Descargar ZIP de los filtrados
        </button>
        {trabajando && (
          <button type="button" style={boton} onClick={() => { cancelar.current = true; }}>
            Cancelar
          </button>
        )}
      </div>
      {aviso && <p style={{ fontSize: 14 }}>{aviso}</p>}
    </main>
  );
}
