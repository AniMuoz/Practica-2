import { useEffect, useState } from "react";

const originalFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const respuesta = await originalFetch(...args);
  if (respuesta.status === 401) {
    const url = String(typeof args[0] === "string" ? args[0] : args[0]?.url || "");
    if (!/\/api\/(login|logout|sesion)/.test(url)) window.dispatchEvent(new Event("sesion-vencida"));
  }
  return respuesta;
};

const campo = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid var(--borde)",
  borderRadius: 6,
  fontSize: 15,
};

function CampoClave({ value, onChange, placeholder, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={visible ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={onChange}
        style={{ ...campo, paddingRight: 40 }}
      />
      <button
        type="button"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        onClick={() => setVisible((actual) => !actual)}
        style={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          border: 0,
          background: "transparent",
          padding: 4,
          cursor: "pointer",
          color: "var(--texto)",
          display: "flex",
        }}
      >
        {visible ? (
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
        )}
      </button>
    </div>
  );
}

const estiloEnlace = {
  border: 0,
  background: "transparent",
  color: "var(--texto)",
  fontSize: 13,
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0,
  alignSelf: "flex-start",
};

function CambiarClave({ usuarioInicial = "", alTerminar, alCancelar }) {
  const [usuario, setUsuario] = useState(usuarioInicial);
  const [claveActual, setClaveActual] = useState("");
  const [claveNueva, setClaveNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const incompleto = !usuario.trim() || !claveActual || !claveNueva || !repetir;

  async function enviar(event) {
    event.preventDefault();
    if (claveNueva !== repetir) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setEnviando(true);
    setError("");
    try {
      const res = await fetch("/api/cambiar-clave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, claveActual, claveNueva }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo cambiar la contraseña.");
      setHecho(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      style={{
        width: "min(360px, 100%)",
        background: "var(--superficie)",
        color: "var(--texto)",
        borderRadius: 8,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 22 }}>Cambiar contraseña</h1>
      {hecho ? (
        <>
          <p style={{ margin: 0 }}>Contraseña actualizada.</p>
          <button type="button" onClick={() => alTerminar(usuario)} style={{ ...estiloEnlace, fontSize: 15 }}>
            Continuar
          </button>
        </>
      ) : (
        <>
          <input
            value={usuario}
            autoComplete="username"
            placeholder="Usuario"
            readOnly={Boolean(usuarioInicial)}
            onChange={(event) => setUsuario(event.target.value)}
            style={campo}
          />
          <CampoClave
            value={claveActual}
            autoComplete="current-password"
            placeholder="Contraseña actual"
            onChange={(event) => setClaveActual(event.target.value)}
          />
          <CampoClave
            value={claveNueva}
            autoComplete="new-password"
            placeholder="Contraseña nueva (mínimo 8 caracteres)"
            onChange={(event) => setClaveNueva(event.target.value)}
          />
          <CampoClave
            value={repetir}
            autoComplete="new-password"
            placeholder="Repite la contraseña nueva"
            onChange={(event) => setRepetir(event.target.value)}
          />
          {error && <p style={{ margin: 0, color: "var(--peligro)" }}>{error}</p>}
          <button
            type="submit"
            disabled={enviando || incompleto}
            style={{
              padding: "10px 14px",
              border: 0,
              borderRadius: 6,
              background: "var(--boton)",
              color: "var(--sobre)",
              fontSize: 15,
              cursor: enviando ? "default" : "pointer",
              opacity: enviando || incompleto ? 0.6 : 1,
            }}
          >
            {enviando ? "Guardando..." : "Cambiar contraseña"}
          </button>
          <button type="button" onClick={alCancelar} style={estiloEnlace}>
            Cancelar
          </button>
        </>
      )}
    </form>
  );
}

function Login({ alEntrar }) {
  const [cambiando, setCambiando] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(event) {
    event.preventDefault();
    setEnviando(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, clave }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar sesión.");
      alEntrar(data.usuario);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: "Segoe UI, sans-serif",
        background: "var(--fondo)",
        color: "var(--texto)",
      }}
    >
      {cambiando ? (
        <CambiarClave
          usuarioInicial=""
          alTerminar={() => setCambiando(false)}
          alCancelar={() => setCambiando(false)}
        />
      ) : (
      <form
        onSubmit={enviar}
        style={{
          width: "min(360px, 100%)",
          background: "var(--superficie)",
          borderRadius: 8,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22 }}>Iniciar sesión</h1>
        <input
          value={usuario}
          autoFocus
          autoComplete="username"
          placeholder="Usuario"
          onChange={(event) => setUsuario(event.target.value)}
          style={campo}
        />
        <CampoClave
          value={clave}
          autoComplete="current-password"
          placeholder="Contraseña"
          onChange={(event) => setClave(event.target.value)}
        />
        {error && <p style={{ margin: 0, color: "var(--peligro)" }}>{error}</p>}
        <button
          type="submit"
          disabled={enviando || !usuario.trim() || !clave}
          style={{
            padding: "10px 14px",
            border: 0,
            borderRadius: 6,
            background: "var(--boton)",
            color: "var(--sobre)",
            fontSize: 15,
            cursor: enviando ? "default" : "pointer",
            opacity: enviando || !usuario.trim() || !clave ? 0.6 : 1,
          }}
        >
          {enviando ? "Entrando..." : "Entrar"}
        </button>
        <button type="button" onClick={() => setCambiando(true)} style={estiloEnlace}>
          Cambiar contraseña
        </button>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>La sesión se mantiene iniciada durante 7 días.</p>
      </form>
      )}
    </main>
  );
}

export default function Acceso({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [verificando, setVerificando] = useState(true);
  const [cambiandoClave, setCambiandoClave] = useState(false);

  useEffect(() => {
    originalFetch("/api/sesion", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUsuario(data ? data.usuario : null))
      .catch(() => setUsuario(null))
      .finally(() => setVerificando(false));
  }, []);

  useEffect(() => {
    const vencida = () => setUsuario(null);
    window.addEventListener("sesion-vencida", vencida);
    return () => window.removeEventListener("sesion-vencida", vencida);
  }, []);

  if (verificando) return null;
  if (!usuario) return <Login alEntrar={setUsuario} />;

  return (
    <>
      {children}
      <div style={{ position: "fixed", right: 10, bottom: 10, zIndex: 30, display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={() => setCambiandoClave(true)}
          title={`Sesión de ${usuario}`}
          style={{
            padding: "6px 10px",
            border: "1px solid var(--borde)",
            borderRadius: 6,
            background: "var(--superficie)",
            color: "var(--texto)",
            fontSize: 12,
            cursor: "pointer",
            opacity: 0.85,
          }}
        >
          Cambiar contraseña
        </button>
      </div>
      {cambiandoClave && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 40,
          }}
        >
          <CambiarClave
            usuarioInicial={usuario}
            alTerminar={() => setCambiandoClave(false)}
            alCancelar={() => setCambiandoClave(false)}
          />
        </div>
      )}
    </>
  );
}
