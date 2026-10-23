import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSesion } from "./Acceso.jsx";
import FiltrosTabla, { FILTROS_INICIALES } from "./FiltrosTabla.jsx";
import Navbar from "./Navbar.jsx";
import { crearQrPng, estadoQr, marcaRombo, sinQr, tieneRombo } from "./generarQr.js";
import { filtrarFilas } from "./reglasPlanilla.js";
import { iniciarRecorrido, recorridoPendiente } from "./Recorrido.jsx";

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
  const [verClave, setVerClave] = useState(false);
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [errorClave, setErrorClave] = useState("");
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
    if (rol === "admin") {
      cargar();
      if (recorridoPendiente("qr")) iniciarRecorrido("qr");
    }
  }, [rol]);

  const filtradas = useMemo(() => filtrarFilas(filas, filtros), [filas, filtros]);
  const faltantes = useMemo(() => sinQr(filtradas), [filtradas]);
  const desactualizados = useMemo(() => filtradas.filter((f) => estadoQr(f) === "desactualizado"), [filtradas]);
  const pendientes = useMemo(() => [...faltantes, ...desactualizados], [faltantes, desactualizados]);
  const romboDe = (fila) => (tieneRombo(fila) ? String(fila.Rombo).trim() : "");

  if (rol !== "admin") return <Navigate to="/" replace />;

  function aceptarClave(event) {
    event.preventDefault();
    setErrorClave("");
    fetch("/api/acceso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Contraseña incorrecta.");
        setDesbloqueado(true);
      })
      .catch((e) => setErrorClave(e.message));
  }

  async function generarYSubir() {
    if (!clave) return setAviso("Escribe la contraseña de datos.");
    if (!pendientes.length) return setAviso("No hay QR faltantes ni desactualizados con estos filtros.");
    if (!window.confirm(`¿Generar y subir ${pendientes.length} QR (${faltantes.length} nuevos, ${desactualizados.length} a regenerar por rombo nuevo/cambiado)?`)) return;
    cancelar.current = false;
    setTrabajando(true);
    let ok = 0;
    const fallidos = [];
    for (let i = 0; i < pendientes.length; i++) {
      if (cancelar.current) break;
      const codigo = String(pendientes[i].Codigo);
      setAviso(`Subiendo ${i + 1} de ${pendientes.length}...`);
      try {
        const rombo = romboDe(pendientes[i]);
        const blob = await crearQrPng(codigo, undefined, rombo);
        const cuerpo = new FormData();
        cuerpo.append("clave", clave);
        cuerpo.append("campo", "QR");
        if (rombo) cuerpo.append("rombo_usado", marcaRombo(rombo));
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
    cancelar.current = false;
    setTrabajando(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const lista = filtradas;
      let sinRombo = 0;
      for (let i = 0; i < lista.length; i++) {
        if (cancelar.current) {
          setAviso("Descarga cancelada.");
          setTrabajando(false);
          return;
        }
        const codigo = String(lista[i].Codigo);
        setAviso(`Generando ${i + 1} de ${lista.length}...`);
        let png;
        try {
          png = await crearQrPng(codigo, undefined, romboDe(lista[i]));
        } catch {
          // Si falla el rombo (imagen faltante o rota) se genera el QR sin rombo.
          sinRombo++;
          png = await crearQrPng(codigo);
        }
        zip.file(`qr_${codigo}.png`, png);
      }
      if (cancelar.current) {
        setAviso("Descarga cancelada.");
        setTrabajando(false);
        return;
      }
      const url = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "qr_materiales.zip";
      a.click();
      URL.revokeObjectURL(url);
      setAviso(`ZIP con ${lista.length} QR descargado.${sinRombo ? ` ${sinRombo} se generaron sin rombo porque no se pudo cargar su imagen.` : ""}`);
    } catch {
      setAviso("No se pudo generar el ZIP.");
    }
    setTrabajando(false);
  }

  const conQr = filtradas.length - pendientes.length;
  const naranja = "#ea580c";
  const pct = filtradas.length ? Math.round((conQr / filtradas.length) * 100) : 0;
  const tarjeta = { background: "var(--fondo-tarjeta, rgba(127,127,127,0.08))", border: "1px solid var(--borde)", borderRadius: 10, padding: "14px 18px", minWidth: 150 };
  const numero = (color) => ({ fontSize: 30, fontWeight: 700, color });
  const botonAccion = (activo) => ({ ...boton, padding: "10px 18px", opacity: activo ? 1 : 0.45, cursor: activo ? "pointer" : "not-allowed" });
  const habilitado = desbloqueado && !trabajando;
  const ojo = verClave ? (
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
  );

  return (
    <main style={{ minHeight: "100vh", boxSizing: "border-box", margin: 0, padding: 16, fontFamily: "Segoe UI, sans-serif", background: "var(--fondo)", color: "var(--texto)" }}>
      <Navbar />
      <div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>Generador de QR</h1>
      <p style={{ margin: "0 0 16px", fontSize: 14, opacity: 0.75 }}>
        Revisa qué materiales ya tienen QR y cuáles faltan. Los QR nuevos se suben solo a las filas que no tienen uno.
      </p>
      {error && <p style={{ color: "var(--peligro)" }}>{error}</p>}

      <section data-tour="qr-resumen" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginBottom: 12 }}>
        <div style={tarjeta}>
          <div style={numero("inherit")}>{filtradas.length}</div>
          <div style={{ fontSize: 13 }}>Materiales filtrados</div>
        </div>
        <div style={{ ...tarjeta, borderColor: "#16a34a" }}>
          <div style={numero("#16a34a")}>{conQr}</div>
          <div style={{ fontSize: 13 }}>Con QR</div>
        </div>
        <div style={{ ...tarjeta, borderColor: "#dc2626" }}>
          <div style={numero("#dc2626")}>{faltantes.length}</div>
          <div style={{ fontSize: 13 }}>Sin QR (faltan)</div>
        </div>
        <div style={{ ...tarjeta, borderColor: naranja }}>
          <div style={numero(naranja)}>{desactualizados.length}</div>
          <div style={{ fontSize: 13 }}>QR desactualizados (rombo)</div>
        </div>
      </section>
      <div data-tour="qr-avance" style={{ height: 12, borderRadius: 6, background: "#dc262633", overflow: "hidden", maxWidth: 520, margin: "0 auto" }} aria-label="Avance de QR">
        <div style={{ width: `${pct}%`, height: "100%", background: "#16a34a", transition: "width .3s" }} />
      </div>
      <p style={{ fontSize: 13, margin: "6px 0 16px" }}>{pct}% de los materiales filtrados ya tiene QR.</p>

      <section data-tour="qr-acciones" style={{ border: "2px solid var(--boton)", borderRadius: 12, padding: 16, margin: "0 auto 20px", maxWidth: 760 }}>
      <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>Acciones</h2>
      {!desbloqueado && (
        <form onSubmit={aceptarClave} style={{ display: "flex", justifyContent: "center", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ position: "relative" }}>
            <input
              type={verClave ? "text" : "password"}
              value={clave}
              placeholder="Contraseña de datos"
              autoFocus
              onChange={(e) => setClave(e.target.value)}
              style={{ padding: "8px 36px 8px 12px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
            />
            <button
              type="button"
              aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setVerClave((v) => !v)}
              style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", padding: 4, cursor: "pointer", color: "var(--texto)", display: "flex" }}
            >
              {ojo}
            </button>
          </div>
          <button type="submit" style={boton}>Aceptar</button>
          {errorClave && <span style={{ color: "var(--peligro)", fontSize: 14 }}>{errorClave}</span>}
          <span style={{ fontSize: 13, opacity: 0.75, flexBasis: "100%" }}>Ingresa la contraseña para habilitar los botones de acción.</span>
        </form>
      )}
      {desbloqueado && <p style={{ fontSize: 14, color: "#16a34a", margin: "0 0 12px" }}>Contraseña aceptada.</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
        <button type="button" style={botonAccion(habilitado)} disabled={!habilitado} onClick={generarYSubir}>
          Generar y subir {pendientes.length} QR (faltantes y desactualizados)
        </button>
        <button type="button" style={botonAccion(habilitado)} disabled={!habilitado} onClick={descargarZip}>
          Descargar ZIP de los filtrados
        </button>
        {trabajando && (
          <button type="button" style={boton} onClick={() => { cancelar.current = true; }}>
            Cancelar
          </button>
        )}
      </div>
      {aviso && <p style={{ fontSize: 14 }}>{aviso}</p>}
      </section>

      <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Filtros</h2>
      <div data-tour="qr-filtros">
        <FiltrosTabla filas={filas} filtros={filtros} onChange={setFiltros} sinOrden />
      </div>

      </div>
    </main>
  );
}