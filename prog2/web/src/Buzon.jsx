import { useCallback, useEffect, useState } from "react";
import Navbar from "./Navbar.jsx";
import { useSesion } from "./Acceso.jsx";

const URGENCIAS = ["leve", "media", "alta", "urgente"];
const COLOR_URGENCIA = { leve: "#2e7d32", media: "#f9a825", alta: "#ef6c00", urgente: "#c62828" };
const ESTADOS = ["sin revisar", "revisando", "cerrado"];

const cajaEstilo = { border: "2px solid var(--texto)", borderRadius: 4, padding: "6px 10px", fontSize: 14 };
const botonEstilo = (fondo = "var(--boton)") => ({ padding: "8px 14px", border: 0, borderRadius: 6, background: fondo, color: "var(--sobre)", fontSize: 14, cursor: "pointer" });

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

// Tarjeta con la disposición de la maqueta: título / estado / ID, descripción, usuario / urgencia / fecha.
function Mensaje({ m, admin, onEstado, onEliminar }) {
  const [minimizado, setMinimizado] = useState(false);
  return (
    <article style={{ background: "var(--superficie)", border: "1px solid var(--borde)", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ ...cajaEstilo, flex: "1 1 200px", fontWeight: 700 }}>{m.titulo}</div>
        {!minimizado && <div style={{ ...cajaEstilo, textTransform: "capitalize" }}>{m.estado}</div>}
        <div style={{ ...cajaEstilo }}>ID {m.id}</div>
        {minimizado && <div style={{ ...cajaEstilo }}>{m.usuario}</div>}
        <button type="button" onClick={() => setMinimizado(!minimizado)} style={botonEstilo("var(--apagado)")} aria-label={minimizado ? "Expandir" : "Minimizar"}>
          {minimizado ? "+" : "−"}
        </button>
      </div>
      {!minimizado && (
        <>
          <div style={{ ...cajaEstilo, minHeight: 80, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.descripcion}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={cajaEstilo}>{m.usuario}</div>
            <div style={{ ...cajaEstilo, borderColor: COLOR_URGENCIA[m.urgencia], color: COLOR_URGENCIA[m.urgencia], fontWeight: 700, textTransform: "capitalize" }}>
              {m.urgencia}
            </div>
            <div style={{ ...cajaEstilo, marginLeft: "auto" }}>{fechaLegible(m.creado_en)}</div>
          </div>
          {admin && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ESTADOS.filter((e) => e !== m.estado).map((e) => (
                <button key={e} type="button" onClick={() => onEstado(m.id, e)} style={botonEstilo()}>
                  Pasar a {e}
                </button>
              ))}
              {m.estado === "cerrado" && (
                <button type="button" onClick={() => onEliminar(m.id)} style={botonEstilo("var(--peligro)")}>
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
    <form onSubmit={enviar} style={{ background: "var(--superficie)", borderRadius: 8, padding: 14, display: "grid", gap: 10, marginBottom: 16, maxWidth: 720 }}>
      <h3 style={{ margin: 0 }}>Nueva sugerencia o reclamo</h3>
      <input value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" aria-label="Título" style={{ ...cajaEstilo, fontWeight: 400 }} />
      <textarea value={descripcion} maxLength={2000} rows={5} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción" aria-label="Descripción" style={{ ...cajaEstilo, resize: "vertical" }} />
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
        Nivel de urgencia
        <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)} style={{ padding: "8px 10px", borderRadius: 6, fontSize: 14 }}>
          {URGENCIAS.map((u) => (
            <option key={u} value={u}>{u[0].toUpperCase() + u.slice(1)}</option>
          ))}
        </select>
      </label>
      {error && <p style={{ margin: 0, color: "var(--peligro)" }}>{error}</p>}
      <div>
        <button type="submit" disabled={enviando || !titulo.trim() || !descripcion.trim()} style={botonEstilo()}>
          {enviando ? "Enviando..." : "Enviar"}
        </button>
      </div>
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
      <h2 style={{ marginTop: 0 }}>Buzón de sugerencias y reclamos</h2>
      {!admin && <Formulario alEnviar={cargar} />}
      {admin && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {ESTADOS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setSeccion(e)}
              style={{ ...botonEstilo(seccion === e ? "var(--acento)" : "var(--boton)"), textTransform: "capitalize" }}
            >
              {e} ({mensajes.filter((m) => m.estado === e).length})
            </button>
          ))}
        </div>
      )}
      {!admin && <h3>Mis mensajes enviados</h3>}
      {error && <p style={{ color: "var(--peligro)" }}>{error}</p>}
      <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
        {visibles.length === 0 && <p>No hay mensajes.</p>}
        {visibles.map((m) => (
          <Mensaje key={m.id} m={m} admin={admin} onEstado={cambiarEstado} onEliminar={eliminar} />
        ))}
      </div>
    </main>
  );
}
