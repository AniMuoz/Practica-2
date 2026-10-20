import { useCallback, useEffect, useRef, useState } from "react";
import { useSesion } from "./Acceso.jsx";
import Navbar from "./Navbar.jsx";

const campo = {
  padding: "8px 10px",
  border: "1px solid var(--borde)",
  borderRadius: 6,
  fontSize: 14,
  boxSizing: "border-box",
};

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
  const res = await fetch(url, opciones);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo completar la operación.");
  return data;
}

const enviarJson = (metodo, cuerpo) => ({
  method: metodo,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(cuerpo),
});

function FilaPersonal({ persona, propia, ocupado, alEjecutar, alSucio, alCambiar, alError }) {
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

  return (
    <tr>
      <td>{persona.usuario}</td>
      <td>{persona.rol}</td>
      <td>{persona.creado_en ? new Date(persona.creado_en).toLocaleDateString() : ""}</td>
      <td>
        {!propia && (
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
  const { usuario: yo } = useSesion();
  const [personas, setPersonas] = useState([]);
  const [errorCarga, setErrorCarga] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [nombre, setNombre] = useState("");
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [rol, setRol] = useState("operador");
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
        await pedir("/api/usuarios", enviarJson("POST", { usuario: nombre, clave, rol }));
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

  return (
    <main style={{ minHeight: "100vh", boxSizing: "border-box", margin: 0, padding: 16, fontFamily: "Segoe UI, sans-serif", background: "var(--fondo)", color: "var(--texto)" }}>
      <Navbar />
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 16px", fontSize: 22, textAlign: "center" }}>Personal</h1>
        {errorCarga ? (
          <p style={{ color: "var(--peligro)" }}>{errorCarga}</p>
        ) : (
          <>
            <form onSubmit={crear} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, justifyContent: "center" }}>
              <input value={nombre} disabled={ocupado} placeholder="Nombre de usuario" autoComplete="off" onChange={(e) => setNombre(e.target.value)} style={campo} />
              <input type="password" value={clave} disabled={ocupado} placeholder="Contraseña inicial" autoComplete="new-password" onChange={(e) => setClave(e.target.value)} style={campo} />
              <input type="password" value={repetir} disabled={ocupado} placeholder="Repetir contraseña" autoComplete="new-password" onChange={(e) => setRepetir(e.target.value)} style={campo} />
              <select value={rol} disabled={ocupado} onChange={(e) => setRol(e.target.value)} style={campo}>
                <option value="operador">Operador</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit" disabled={ocupado || sinDatos} style={{ ...boton, opacity: ocupado || sinDatos ? 0.6 : 1 }}>
                {ocupado ? "Procesando..." : "Crear usuario"}
              </button>
            </form>
            {error && <p style={{ color: "var(--peligro)" }}>{error}</p>}
            {aviso && <p>{aviso}</p>}
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", textAlign: "left" }}>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Alta</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {personas.map((persona) => (
                    <FilaPersonal
                      key={persona.usuario}
                      persona={persona}
                      propia={persona.usuario === yo}
                      ocupado={ocupado}
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
    </main>
  );
}
