import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "../logo/logo.ico";
import { useColoresPlanilla } from "./ColoresPlanilla.jsx";
import { iniciarRecorrido } from "./Recorrido.jsx";

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [codigo, setCodigo] = useState("");
  const { colores, cambiarColores, oscuro, cambiarOscuro } = useColoresPlanilla();

  return (
    <header
      className="barra"
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 16,
        padding: "10px 14px",
        background: "var(--superficie)",
        borderRadius: 8,
      }}
    >
      <Link
        data-tour="titulo"
        to="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "var(--texto)",
          textDecoration: "none",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        <img src={logo} alt="" width={28} height={28} />
        Inventario M501
      </Link>
      <button
        type="button"
        className="barra-ayuda"
        aria-label="Ayuda"
        onClick={() => iniciarRecorrido(pathname === "/admin" ? "admin" : pathname === "/" ? "principal" : "material")}
        style={{
          width: 28,
          height: 28,
          padding: 0,
          border: "2px solid var(--texto)",
          borderRadius: "50%",
          background: "transparent",
          color: "var(--texto)",
          fontSize: 16,
          fontWeight: 700,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ?
      </button>
      <button
        type="button"
        className="barra-switch"
        role="switch"
        aria-checked={colores}
        data-tour="colores"
        aria-label="Colores en planillas"
        onClick={() => cambiarColores(!colores)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: 0,
          border: 0,
          background: "transparent",
          cursor: "pointer",
          fontSize: 14,
          color: "var(--texto)",
        }}
      >
        Colores
        <span
          style={{
            position: "relative",
            width: 44,
            height: 24,
            borderRadius: 999,
            background: colores ? "var(--acento)" : "var(--interruptor)",
            transition: "background 0.2s ease",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: colores ? 22 : 2,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.2s ease",
            }}
          />
        </span>
      </button>
      <button
        type="button"
        className="barra-switch"
        role="switch"
        aria-checked={oscuro}
        data-tour="oscuro"
        aria-label="Modo oscuro"
        onClick={() => cambiarOscuro(!oscuro)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: 0,
          border: 0,
          background: "transparent",
          cursor: "pointer",
          fontSize: 14,
          color: "var(--texto)",
        }}
      >
        Oscuro
        <span
          style={{
            position: "relative",
            width: 44,
            height: 24,
            borderRadius: 999,
            background: oscuro ? "var(--acento)" : "var(--interruptor)",
            transition: "background 0.2s ease",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: oscuro ? 22 : 2,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.2s ease",
            }}
          />
        </span>
      </button>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const buscado = codigo.trim();
          if (!buscado) return;
          navigate(`/${encodeURIComponent(buscado)}`);
        }}
        data-tour="buscar"
        className="barra-buscar"
        style={{ display: "flex", gap: 8, marginLeft: "auto", flex: "0 1 auto", minWidth: 0 }}
      >
        <input
          value={codigo}
          onChange={(event) => setCodigo(event.target.value)}
          placeholder="Código de material"
          aria-label="Código de material"
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 14,
            minWidth: 180,
          }}
        />
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
          Buscar
        </button>
      </form>
      <Link
        to="/admin"
        className="barra-admin"
        style={{
          padding: "8px 14px",
          borderRadius: 6,
          background: "var(--boton)",
          color: "var(--sobre)",
          fontSize: 14,
          textDecoration: "none",
        }}
      >
        Admin
      </Link>
    </header>
  );
}
