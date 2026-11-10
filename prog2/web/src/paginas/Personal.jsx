import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSesion } from "../componentes/Acceso.jsx";
import Navbar from "../componentes/Navbar.jsx";
import { iniciarRecorrido, recorridoPendiente } from "../componentes/Recorrido.jsx";
import { apiFetch } from "../lib/api.js";
import { BODEGAS } from "../lib/bodega.js";

const campo = {
  padding: "8px 10px",
  border: "1px solid var(--borde)",
  borderRadius: 6,
  fontSize: 14,
  boxSizing: "border-box",
};

const OPCIONES_ORDEN = [
  ["usuario", "Usuario"],
  ["fecha", "Fecha de alta"],
  ["rol", "Rol"],
  ["bodega", "Bodega"],
];

const texto = (v) => String(v ?? "").trim().toLowerCase();
const porTexto = (extraer) => (a, b) => texto(extraer(a)).localeCompare(texto(extraer(b)), "es");
const porUsuario = porTexto((p) => p.usuario);
const tiempo = (p) => (p.creado_en ? new Date(p.creado_en).getTime() : 0);

// Comparador principal de cada orden; el empate se resuelve siempre por usuario.
const COMPARADORES = {
  usuario: () => 0,
  fecha: (a, b) => tiempo(b) - tiempo(a),
  rol: porTexto((p) => p.rol),
  bodega: porTexto((p) => p.bodega || "M501"),
};

function ordenarPersonas(lista, orden) {
  const principal = COMPARADORES[orden] || COMPARADORES.usuario;
  return [...lista].sort((a, b) => principal(a, b) || porUsuario(a, b));
}

const boton = {
  padding: "8px 14px",
  border: 0,
  borderRadius: 6,
  background: "var(--boton)",
  color: "var(--sobre)",
  fontSize: 14,
  cursor: "pointer",
};

async function pedir(url, opciones) {
  const res = await apiFetch(url, opciones);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo completar la operación.");
  return data;
}

const enviarJson = (metodo, cuerpo) => ({
  method: metodo,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(cuerpo),
});

function FilaPersonal({ persona, propia, ocupado, puedeCambiarBodega, alEjecutar, alSucio, alCambiar, alError }) {
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");

  useEffect(() => {
    alSucio(persona.usuario, Boolean(clave || repetir));
    return () => alSucio(persona.usuario, false);
  }, [clave, repetir, persona.usuario, alSucio]);

  async function resetear() {
    if (clave !== repetir) {
      alError("Las contraseñas nuevas no coinciden.");
      return;
    }
    await alEjecutar(async () => {
      try {
        await pedir(`/api/usuarios/${encodeURIComponent(persona.usuario)}/clave`, enviarJson("POST", { clave }));
        setClave("");
        setRepetir("");
        alCambiar(`Contraseña de ${persona.usuario} actualizada.`);
      } catch (e) {
        alError(e.message);
      }
    });
  }

  async function eliminar() {
    if (!window.confirm(`¿Eliminar al usuario ${persona.usuario}?`)) return;
    await alEjecutar(async () => {
      try {
        await pedir(`/api/usuarios/${encodeURIComponent(persona.usuario)}`, { method: "DELETE" });
        alCambiar(`Usuario ${persona.usuario} eliminado.`);
      } catch (e) {
        alError(e.message);
      }
    });
  }

  const sinDatos = !clave || !repetir;
  const protegido = persona.usuario === "adminm501";

  async function cambiarRol(nuevo) {
    await alEjecutar(async () => {
      try {
        await pedir(`/api/usuarios/${encodeURIComponent(persona.usuario)}/rol`, enviarJson("POST", { rol: nuevo }));
        alCambiar(`Rol de ${persona.usuario} actualizado a ${nuevo}.`);
      } catch (e) {
        alError(e.message);
      }
    });
  }

  async function cambiarBodega(nueva) {
    await alEjecutar(async () => {
      try {
        await pedir(`/api/usuarios/${encodeURIComponent(persona.usuario)}/bodega`, enviarJson("POST", { bodega: nueva }));
        alCambiar(`Bodega de ${persona.usuario} actualizada a ${nueva}.`);
      } catch (e) {
        alError(e.message);
      }
    });
  }

  return (
    <tr>
      <td>{persona.usuario}</td>
      <td>
        {propia || protegido ? (
          persona.rol
        ) : (
          <select value={persona.rol} disabled={ocupado} onChange={(e) => cambiarRol(e.target.value)} style={campo}>
            <option value="operador">Operador</option>
            <option value="admin">Admin</option>
            <option value="desactivado">Desactivado</option>
          </select>
        )}
      </td>
      <td>
        {protegido || !puedeCambiarBodega ? (
          persona.bodega || "M501"
        ) : (
          <select value={persona.bodega || "M501"} disabled={ocupado} onChange={(e) => cambiarBodega(e.target.value)} style={campo}>
            {BODEGAS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        )}
      </td>
      <td>{persona.creado_en ? new Date(persona.creado_en).toLocaleDateString() : ""}</td>
      <td>
        {!propia && !protegido && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input type="password" autoComplete="new-password" placeholder="Nueva contraseña" value={clave} disabled={ocupado} onChange={(e) => setClave(e.target.value)} style={{ ...campo, width: 150 }} />
            <input type="password" autoComplete="new-password" placeholder="Repetir" value={repetir} disabled={ocupado} onChange={(e) => setRepetir(e.target.value)} style={{ ...campo, width: 110 }} />
            <button type="button" onClick={resetear} disabled={ocupado || sinDatos} style={{ ...boton, opacity: ocupado || sinDatos ? 0.6 : 1 }}>
              Cambiar
            </button>
            <button type="button" onClick={eliminar} disabled={ocupado} style={{ ...boton, background: "#d32f2f", color: "#fff", opacity: ocupado ? 0.6 : 1 }}>
              Eliminar
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function Personal() {
  const { usuario: yo, bodega: bodegaUsuario } = useSesion();
  const esAdminM501 = (bodegaUsuario || "M501") === "M501";
  const [personas, setPersonas] = useState([]);
  const [errorCarga, setErrorCarga] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [nombre, setNombre] = useState("");
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [rol, setRol] = useState("operador");
  const [bodegaNueva, setBodegaNueva] = useState("M501");
  const [orden, setOrden] = useState("usuario");
  const [ocupado, setOcupado] = useState(false);

  const ocupadoRef = useRef(false);
  const sucias = useRef(new Set());
  const formSucioRef = useRef(false);
  formSucioRef.current = Boolean(nombre || clave || repetir);

  const alSucio = useCallback((id, sucio) => {
    if (sucio) sucias.current.add(id);
    else sucias.current.delete(id);
  }, []);

  const alEjecutar = useCallback(async (fn) => {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setOcupado(true);
    try {
      await fn();
    } finally {
      ocupadoRef.current = false;
      setOcupado(false);
    }
  }, []);

  // Pregunta antes de cerrar/recargar la pestaña mientras hay operaciones o datos sin guardar.
  useEffect(() => {
    const avisar = (e) => {
      if (ocupadoRef.current || formSucioRef.current || sucias.current.size > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, []);

  const cargar = useCallback(async () => {
    try {
      const data = await pedir("/api/usuarios");
      setPersonas(data.usuarios || []);
      setErrorCarga("");
    } catch (e) {
      setErrorCarga(e.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    const espera = setTimeout(() => {
      if (recorridoPendiente("personal")) iniciarRecorrido("personal");
    }, 0);
    return () => clearTimeout(espera);
  }, []);

  async function crear(event) {
    event.preventDefault();
    setError("");
    setAviso("");
    if (clave !== repetir) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    await alEjecutar(async () => {
      try {
        await pedir("/api/usuarios", enviarJson("POST", { usuario: nombre, clave, rol, bodega: bodegaNueva }));
        setAviso(`Usuario ${nombre.trim().toLowerCase()} creado.`);
        setNombre("");
        setClave("");
        setRepetir("");
        setRol("operador");
        cargar();
      } catch (e) {
        setError(e.message);
      }
    });
  }

  const tras = (mensaje) => {
    setError("");
    setAviso(mensaje);
    cargar();
  };
  const fallo = (mensaje) => {
    setAviso("");
    setError(mensaje);
  };

  const sinDatos = !nombre.trim() || !clave || !repetir;
  const personasOrdenadas = useMemo(() => ordenarPersonas(personas, orden), [personas, orden]);

  return (
    <main style={{ minHeight: "100vh", boxSizing: "border-box", margin: 0, padding: 16, fontFamily: "Segoe UI, sans-serif", background: "var(--fondo)", color: "var(--texto)" }}>
      <Navbar />
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 16px", fontSize: 22, textAlign: "center" }}>Personal</h1>
        {errorCarga ? (
          <p style={{ color: "var(--peligro)" }}>{errorCarga}</p>
        ) : (
          <>
            {esAdminM501 && (
            <form data-tour="personal-crear" onSubmit={crear} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, justifyContent: "center" }}>
              <input value={nombre} disabled={ocupado} placeholder="Nombre de usuario" autoComplete="off" onChange={(e) => setNombre(e.target.value)} style={campo} />
              <input type="password" value={clave} disabled={ocupado} placeholder="Contraseña inicial" autoComplete="new-password" onChange={(e) => setClave(e.target.value)} style={campo} />
              <input type="password" value={repetir} disabled={ocupado} placeholder="Repetir contraseña" autoComplete="new-password" onChange={(e) => setRepetir(e.target.value)} style={campo} />
              <select value={rol} disabled={ocupado} onChange={(e) => setRol(e.target.value)} style={campo}>
                <option value="operador">Operador</option>
                <option value="admin">Admin</option>
              </select>
              <select value={bodegaNueva} disabled={ocupado} onChange={(e) => setBodegaNueva(e.target.value)} style={campo} aria-label="Bodega">
                {BODEGAS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <button type="submit" disabled={ocupado || sinDatos} style={{ ...boton, opacity: ocupado || sinDatos ? 0.6 : 1 }}>
                {ocupado ? "Procesando..." : "Crear usuario"}
              </button>
            </form>
            )}
            {error && <p style={{ color: "var(--peligro)" }}>{error}</p>}
            {aviso && <p>{aviso}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                Ordenar por
                <select
                  data-tour="personal-orden"
                  aria-label="Ordenar personal"
                  value={orden}
                  onChange={(e) => setOrden(e.target.value)}
                  style={campo}
                >
                  {OPCIONES_ORDEN.map(([valor, titulo]) => (
                    <option key={valor} value={valor}>{titulo}</option>
                  ))}
                </select>
              </label>
            </div>
            <div data-tour="personal-tabla" style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", textAlign: "left" }}>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Bodega</th>
                    <th>Alta</th>
                    <th data-tour="personal-acciones">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {personasOrdenadas.map((persona) => (
                    <FilaPersonal
                      key={persona.usuario}
                      persona={persona}
                      propia={persona.usuario === yo}
                      ocupado={ocupado}
                      puedeCambiarBodega={esAdminM501}
                      alEjecutar={alEjecutar}
                      alSucio={alSucio}
                      alCambiar={tras}
                      alError={fallo}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <div className="footer">
        <p>© 2026 Berfre - Práctica 2 - Transformación digital - React - Anibal Alexis Muñoz Reyes - UNAB</p>
    </div>
    </main>
  );
}
