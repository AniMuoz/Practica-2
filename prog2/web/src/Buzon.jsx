import { useCallback, useEffect, useState } from "react";
import Navbar from "./Navbar.jsx";
import { useSesion } from "./Acceso.jsx";
import "./buzon.css";

const URGENCIAS = ["leve", "media", "alta", "urgente"];
const COLOR_URGENCIA = { leve: "#2e7d32", media: "#f9a825", alta: "#ef6c00", urgente: "#c62828" };
const COLOR_ESTADO = { "sin revisar": "#d32f2f", revisando: "#ef6c00", cerrado: "#2e7d32" };
const ESTADOS = ["sin revisar", "revisando", "cerrado"];

async function pedir(url, opciones) {
  const res = await fetch(url, opciones);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error de conexión.");
  return data;
}

function fechaLegible(iso) {
  const f = new Date(iso);
  return Number.isNaN(f.getTime()) ? "" : f.toLocaleString("es-CL");
}

function Mensaje({ m, admin, onEstado, onEliminar }) {
  const [minimizado, setMinimizado] = useState(false);
  const color = COLOR_URGENCIA[m.urgencia];
  return (
    <article className="buzon-card" style={{ borderLeft: `6px solid ${color}` }}>
      <div className="buzon-cabeza">
        <div className="buzon-titulo">{m.titulo}</div>
        {!minimizado && <span className="buzon-chip">{m.estado}</span>}
        <span className="buzon-chip id">ID {m.id}</span>
        {minimizado && <span className="buzon-chip">{m.usuario}</span>}
        <button type="button" className="buzon-btn suave" onClick={() => setMinimizado(!minimizado)} aria-label={minimizado ? "Expandir" : "Minimizar"}>
          {minimizado ? "+" : "−"}
        </button>
      </div>
      {!minimizado && (
        <>
          <div className="buzon-desc">{m.descripcion}</div>
          <div className="buzon-pie">
            <span>👤 {m.usuario}</span>
            <span className="buzon-chip" style={{ borderColor: color, color }}>{m.urgencia}</span>
            <span>{fechaLegible(m.creado_en)}</span>
          </div>
          {admin && (
            <div className="buzon-acciones">
              {ESTADOS.filter((e) => e !== m.estado).map((e) => (
                <button key={e} type="button" className="buzon-btn" onClick={() => onEstado(m.id, e)}>
                  Pasar a {e}
                </button>
              ))}
              {m.estado === "cerrado" && (
                <button type="button" className="buzon-btn peligro" onClick={() => onEliminar(m.id)}>
                  Eliminar
                </button>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}

function Formulario({ alEnviar }) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [urgencia, setUrgencia] = useState("leve");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(event) {
    event.preventDefault();
    setError("");
    setEnviando(true);
    try {
      await pedir("/api/buzon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, descripcion, urgencia }),
      });
      setTitulo("");
      setDescripcion("");
      setUrgencia("leve");
      alEnviar();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="buzon-form">
      <h3>Nueva emergencia o necesidad</h3>
      <label>
        Título
        <input value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} />
      </label>
      <label>
        Descripción
        <textarea value={descripcion} maxLength={2000} rows={5} onChange={(e) => setDescripcion(e.target.value)} />
      </label>
      <label>
        Nivel de urgencia
        <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)}>
          {URGENCIAS.map((u) => (
            <option key={u} value={u}>{u[0].toUpperCase() + u.slice(1)}</option>
          ))}
        </select>
      </label>
      {error && <p className="buzon-error">{error}</p>}
      <button type="submit" className="buzon-btn buzon-enviar" disabled={enviando || !titulo.trim() || !descripcion.trim()}>
        {enviando ? "Enviando..." : "Enviar"}
      </button>
    </form>
  );
}

export default function Buzon() {
  const { rol } = useSesion();
  const admin = rol === "admin";
  const [mensajes, setMensajes] = useState([]);
  const [error, setError] = useState("");
  const [seccion, setSeccion] = useState("sin revisar");

  const cargar = useCallback(() => {
    pedir(admin ? "/api/buzon" : "/api/buzon/mios")
      .then((data) => setMensajes(data.mensajes || []))
      .catch((e) => setError(e.message));
  }, [admin]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function cambiarEstado(id, estado) {
    pedir(`/api/buzon/${id}/estado`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }) })
      .then(cargar)
      .catch((e) => setError(e.message));
  }

  function eliminar(id) {
    if (!window.confirm("¿Eliminar este mensaje cerrado?")) return;
    pedir(`/api/buzon/${id}`, { method: "DELETE" }).then(cargar).catch((e) => setError(e.message));
  }

  const visibles = admin ? mensajes.filter((m) => m.estado === seccion) : mensajes;

  return (
    <main style={{ minHeight: "100vh", margin: 0, padding: 16, fontFamily: "Segoe UI, sans-serif", background: "var(--fondo)", color: "var(--texto)" }}>
      <Navbar />
      <div className="buzon">
        <h2>Buzón de emergencia y necesidad</h2>
        {!admin && <Formulario alEnviar={cargar} />}
        {admin && (
          <div className="buzon-tabs">
            {ESTADOS.map((e) => (
              <button
                key={e}
                type="button"
                className={`buzon-tab${seccion === e ? " activa" : ""}`}
                style={{ "--c": COLOR_ESTADO[e] }}
                onClick={() => setSeccion(e)}
              >
                <span className="punto" />
                <span>{e}</span>
                <span className="cuenta">{mensajes.filter((m) => m.estado === e).length}</span>
              </button>
            ))}
          </div>
        )}
        {!admin && <h3>Mis mensajes enviados</h3>}
        {error && <p className="buzon-error">{error}</p>}
        {visibles.length === 0 && <p className="buzon-vacio">No hay mensajes.</p>}
        {visibles.map((m) => (
          <Mensaje key={m.id} m={m} admin={admin} onEstado={cambiarEstado} onEliminar={eliminar} />
        ))}
      </div>
    </main>
  );
}
