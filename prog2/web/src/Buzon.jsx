import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "./Navbar.jsx";
import { useSesion } from "./Acceso.jsx";
import { sonarActualizacion } from "./sonido.js";
import "./buzon.css";

const URGENCIAS = ["leve", "media", "alta", "urgente"];
const COLOR_URGENCIA = { leve: "#2e7d32", media: "#f9a825", alta: "#ef6c00", urgente: "#c62828" };
const COLOR_ESTADO = { "sin revisar": "#d32f2f", revisando: "#ef6c00", cerrado: "#2e7d32" };
const ESTADOS = ["sin revisar", "revisando", "cerrado"];
const MAX_DESC = 200;
const INTERVALO_NOVEDADES = 15_000; // 15 segundos

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

// ── Helpers de localStorage para rastrear lo "ya visto" ─────────────────────
// Guardamos { [buzonId]: ultimoIdVisto } por usuario en localStorage.

function claveStorage(usuario) {
  return `buzon-visto-${usuario}`;
}

function leerVistos(usuario) {
  try {
    return JSON.parse(localStorage.getItem(claveStorage(usuario)) || "{}");
  } catch {
    return {};
  }
}

function guardarVisto(usuario, buzonId, ultimoId) {
  try {
    const vistos = leerVistos(usuario);
    vistos[buzonId] = ultimoId;
    localStorage.setItem(claveStorage(usuario), JSON.stringify(vistos));
  } catch {
    // sin localStorage
  }
}

// ── Hook de novedades ────────────────────────────────────────────────────────
// Devuelve:
//   novedadTotal    → número total de mensajes con respuestas nuevas no vistas
//   novedadesPorEstado → { "sin revisar": n, "revisando": n, ... } (admin)
//   novedadesPorMensaje → Set de buzonIds con novedades (para resaltar tarjeta)
//   marcarVisto(buzonId, ultimoId) → registra que ya se vio hasta ese id

function useBuzonNovedades(usuario, admin) {
  const [novedadTotal, setNovedadTotal] = useState(0);
  const [novedadesPorEstado, setNovedadesPorEstado] = useState({});
  const [novedadesPorMensaje, setNovedadesPorMensaje] = useState(new Set());
  const prevTotal = useRef(0);

  const marcarVisto = useCallback(
    (buzonId, ultimoId) => {
      guardarVisto(usuario, buzonId, ultimoId);
      setNovedadesPorMensaje((prev) => {
        const next = new Set(prev);
        next.delete(String(buzonId));
        return next;
      });
      setNovedadTotal((prev) => Math.max(0, prev - 1));
    },
    [usuario]
  );

  const verificar = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    fetch("/api/buzon/novedades", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ novedades }) => {
        const vistos = leerVistos(usuario);
        const conNovedad = new Set();
        const porEstado = {};

        for (const [bid, valor] of Object.entries(novedades || {})) {
          // admin: valor = { ultimaId, estado }; operador: valor = ultimaId (número)
          const ultimaId = admin ? valor.ultimaId : valor;
          const estado = admin ? valor.estado : null;
          const visto = vistos[bid] ?? -1;

          if (ultimaId > visto) {
            conNovedad.add(bid);
            if (admin && estado) {
              porEstado[estado] = (porEstado[estado] || 0) + 1;
            }
          }
        }

        const total = conNovedad.size;
        if (total > prevTotal.current) sonarActualizacion();
        prevTotal.current = total;

        setNovedadTotal(total);
        setNovedadesPorEstado(porEstado);
        setNovedadesPorMensaje(conNovedad);
      })
      .catch(() => {});
  }, [usuario, admin]);

  useEffect(() => {
    if (!usuario) return undefined;
    verificar();
    const id = setInterval(verificar, INTERVALO_NOVEDADES);
    document.addEventListener("visibilitychange", verificar);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", verificar);
    };
  }, [verificar, usuario]);

  return { novedadTotal, novedadesPorEstado, novedadesPorMensaje, marcarVisto };
}

// ── Hilo de conversación ─────────────────────────────────────────────────────

function Conversacion({ buzonId, cerrado, usuario, tieneNovedad, marcarVisto, pulso }) {
  const [respuestas, setRespuestas] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const finRef = useRef(null);
  const ultimoIdRef = useRef(null);

  const cargarRespuestas = useCallback(
    (silencioso = false) => {
      fetch(`/api/buzon/${buzonId}/respuestas`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(({ respuestas: lista }) => {
          setRespuestas(lista || []);
          if (!lista || lista.length === 0) {
            marcarVisto(buzonId, -1);
            return;
          }
          const ultimo = lista[lista.length - 1];
          // Si es nuevo (mayor al previo que teníamos) → sonido + marcar visto
          if (ultimoIdRef.current !== null && ultimo.id > ultimoIdRef.current) {
            sonarActualizacion();
          }
          ultimoIdRef.current = ultimo.id;
          marcarVisto(buzonId, ultimo.id);
        })
        .catch((e) => {
          if (!silencioso) setError(e.message);
        });
    },
    [buzonId, marcarVisto]
  );

  // Polling mientras el hilo está abierto + refresco inmediato vía pulso SSE.
  useEffect(() => {
    if (!abierto) return undefined;
    const id = setInterval(() => cargarRespuestas(true), INTERVALO_NOVEDADES);
    return () => clearInterval(id);
  }, [abierto, cargarRespuestas]);

  useEffect(() => {
    if (!abierto || pulso === 0) return;
    cargarRespuestas(true);
  }, [pulso, abierto, cargarRespuestas]);

  function toggleAbrir() {
    if (!abierto) {
      cargarRespuestas(false);
    }
    setAbierto((v) => !v);
  }

  // Scroll al final cuando llegan respuestas.
  useEffect(() => {
    if (abierto && finRef.current) finRef.current.scrollIntoView({ behavior: "smooth" });
  }, [respuestas, abierto]);

  async function enviar(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    setError("");
    setEnviando(true);
    try {
      await pedir(`/api/buzon/${buzonId}/respuestas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      setTexto("");
      cargarRespuestas(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const conteo = respuestas !== null ? respuestas.length : "…";

  return (
    <div className="buzon-conv">
      <button type="button" className="buzon-conv-toggle" onClick={toggleAbrir}>
        <span className="buzon-conv-toggle-inner">
          💬 Conversación {respuestas !== null && <span className="buzon-chip">{conteo}</span>}
          {tieneNovedad && !abierto && <span className="buzon-novedad-dot" aria-label="Respuesta nueva" />}
        </span>
        <span className="buzon-conv-arrow">{abierto ? "▲" : "▼"}</span>
      </button>

      {abierto && (
        <div className="buzon-conv-hilo">
          {respuestas === null && <p className="buzon-vacio">Cargando…</p>}
          {respuestas !== null && respuestas.length === 0 && (
            <p className="buzon-vacio">Sin respuestas todavía.</p>
          )}
          {respuestas !== null &&
            respuestas.map((r) => (
              <div key={r.id} className={`buzon-burbuja ${r.es_admin ? "admin" : "operador"}`}>
                <div className="buzon-burbuja-meta">
                  {r.es_admin && <span className="buzon-admin-badge">Admin</span>}
                  <span className="buzon-burbuja-autor">{r.autor}</span>
                  <span className="buzon-burbuja-fecha">{fechaLegible(r.creado_en)}</span>
                </div>
                <div className="buzon-burbuja-texto">{r.texto}</div>
              </div>
            ))}
          <div ref={finRef} />

          {!cerrado && (
            <form onSubmit={enviar} className="buzon-conv-form">
              <div className="buzon-conv-input-wrap">
                <textarea
                  value={texto}
                  maxLength={MAX_DESC}
                  rows={2}
                  placeholder="Escribe una respuesta…"
                  onChange={(e) => setTexto(e.target.value)}
                  disabled={enviando}
                />
                <span className={`buzon-contador ${texto.length >= MAX_DESC ? "lleno" : ""}`}>
                  {texto.length}/{MAX_DESC}
                </span>
              </div>
              {error && <p className="buzon-error">{error}</p>}
              <button type="submit" className="buzon-btn" disabled={enviando || !texto.trim()}>
                {enviando ? "Enviando…" : "Responder"}
              </button>
            </form>
          )}
          {cerrado && (
            <p className="buzon-vacio" style={{ fontSize: 12 }}>
              Mensaje cerrado · no se aceptan más respuestas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de mensaje ───────────────────────────────────────────────────────

function Mensaje({ m, admin, usuario, onEstado, onEliminar, tieneNovedad, marcarVisto, pulso }) {
  const [minimizado, setMinimizado] = useState(false);
  const color = COLOR_URGENCIA[m.urgencia];
  return (
    <article className={`buzon-card${tieneNovedad ? " con-novedad" : ""}`} style={{ borderLeft: `6px solid ${color}` }}>
      <div className="buzon-cabeza">
        <div className="buzon-titulo">{m.titulo}</div>
        {!minimizado && <span className="buzon-chip">{m.estado}</span>}
        <span className="buzon-chip id">ID {m.id}</span>
        {minimizado && <span className="buzon-chip">{m.usuario}</span>}
        {tieneNovedad && minimizado && <span className="buzon-novedad-dot" aria-label="Respuesta nueva" />}
        <button
          type="button"
          className="buzon-btn suave"
          onClick={() => setMinimizado(!minimizado)}
          aria-label={minimizado ? "Expandir" : "Minimizar"}
        >
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

          <Conversacion
            buzonId={m.id}
            cerrado={m.estado === "cerrado"}
            usuario={usuario}
            tieneNovedad={tieneNovedad}
            marcarVisto={marcarVisto}
            pulso={pulso}
          />

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

// ── Formulario nuevo mensaje ─────────────────────────────────────────────────

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
        <div className="buzon-input-wrap">
          <textarea value={descripcion} maxLength={MAX_DESC} rows={4} onChange={(e) => setDescripcion(e.target.value)} />
          <span className={`buzon-contador ${descripcion.length >= MAX_DESC ? "lleno" : ""}`}>
            {descripcion.length}/{MAX_DESC}
          </span>
        </div>
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

// ── Vista principal ──────────────────────────────────────────────────────────

export default function Buzon() {
  const { rol, usuario } = useSesion();
  const admin = rol === "admin";
  const [mensajes, setMensajes] = useState([]);
  const [error, setError] = useState("");
  const [seccion, setSeccion] = useState("sin revisar");

  const { novedadTotal, novedadesPorEstado, novedadesPorMensaje, marcarVisto } =
    useBuzonNovedades(usuario, admin);

  const idsPrevios = useRef(null);
  const [pulso, setPulso] = useState(0);

  const cargar = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    pedir(admin ? "/api/buzon" : "/api/buzon/mios")
      .then((data) => {
        const lista = data.mensajes || [];
        // Admin: aviso sonoro si llega un mensaje nuevo mientras está en el buzón.
        if (admin && idsPrevios.current !== null) {
          const prev = idsPrevios.current;
          if (lista.some((m) => !prev.has(m.id))) sonarActualizacion();
        }
        idsPrevios.current = new Set(lista.map((m) => m.id));
        setMensajes(lista);
      })
      .catch((e) => setError(e.message));
  }, [admin]);

  // Carga inicial + sondeo periódico (respaldo si el SSE queda en búfer).
  useEffect(() => {
    cargar();
    const id = setInterval(cargar, INTERVALO_NOVEDADES);
    document.addEventListener("visibilitychange", cargar);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", cargar);
    };
  }, [cargar]);

  // Actualización inmediata vía SSE cuando alguien crea/cambia un mensaje.
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
      if (data.tipo !== "buzon") return;
      window.clearTimeout(pendiente);
      pendiente = window.setTimeout(() => {
        cargar();
        setPulso((n) => n + 1);
      }, 200);
    };
    return () => {
      window.clearTimeout(pendiente);
      fuente.close();
    };
  }, [cargar]);

  function cambiarEstado(id, estado) {
    pedir(`/api/buzon/${id}/estado`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    })
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
      <Navbar buzonNovedades={novedadTotal} />
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
                {/* Badge de novedad en esta tab */}
                {novedadesPorEstado[e] > 0 && (
                  <span
                    className="buzon-tab-novedad"
                    aria-label={`${novedadesPorEstado[e]} respuesta${novedadesPorEstado[e] > 1 ? "s" : ""} nueva${novedadesPorEstado[e] > 1 ? "s" : ""}`}
                  />
                )}
              </button>
            ))}
          </div>
        )}
        {!admin && novedadTotal > 0 && (
          <p className="buzon-aviso-novedad">
            🔔 Tienes {novedadTotal} respuesta{novedadTotal > 1 ? "s" : ""} nueva{novedadTotal > 1 ? "s" : ""} del administrador
          </p>
        )}
        {!admin && <h3>Mis mensajes enviados</h3>}
        {error && <p className="buzon-error">{error}</p>}
        {visibles.length === 0 && <p className="buzon-vacio">No hay mensajes.</p>}
        {visibles.map((m) => (
          <Mensaje
            key={m.id}
            m={m}
            admin={admin}
            usuario={usuario}
            onEstado={cambiarEstado}
            onEliminar={eliminar}
            tieneNovedad={novedadesPorMensaje.has(String(m.id))}
            marcarVisto={marcarVisto}
            pulso={pulso}
          />
        ))}
      </div>
    </main>
  );
}
