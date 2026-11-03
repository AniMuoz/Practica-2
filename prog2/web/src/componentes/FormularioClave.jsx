import { useState } from "react";

// Pide la contrasena de administrador. El envio lo resuelve la pagina (alEnviar).
export default function FormularioClave({ clave, setClave, aviso, alEnviar }) {
  const [verClave, setVerClave] = useState(false);
  return (
      <form
        data-tour="admin-clave"
    onSubmit={alEnviar}
        style={{ display: "flex", gap: 8, alignItems: "center" }}
      >
        <div style={{ position: "relative" }}>
          <input
            type={verClave ? "text" : "password"}
            value={clave}
            autoFocus
            placeholder="Contraseña"
            onChange={(event) => setClave(event.target.value)}
            style={{ padding: "8px 36px 8px 12px", border: "1px solid var(--borde)", borderRadius: 6, fontSize: 14 }}
          />
          <button
            type="button"
            aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
            onClick={() => setVerClave((visible) => !visible)}
            style={{
              position: "absolute",
              right: 4,
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
            {verClave ? (
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
        <button
          type="submit"
          style={{
            padding: "8px 14px",
            border: 0,
            borderRadius: 6,
            background: "var(--acento)",
            color: "var(--sobre)",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Entrar
        </button>
        {aviso && <p style={{ margin: 0 }}>{aviso}</p>}
      </form>
  );
}
