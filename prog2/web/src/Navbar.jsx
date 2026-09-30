import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../logo/logo.ico";

export default function Navbar() {
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState("");

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
        background: "#fff",
        borderRadius: 8,
      }}
    >
      <Link
        to="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "#111",
          textDecoration: "none",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        <img src={logo} alt="" width={28} height={28} />
        Inventario M501
      </Link>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const buscado = codigo.trim();
          if (!buscado) return;
          navigate(`/${encodeURIComponent(buscado)}`);
        }}
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
            border: "1px solid #d0d5dd",
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
            background: "#1d4ed8",
            color: "#fff",
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
          background: "#111827",
          color: "#fff",
          fontSize: 14,
          textDecoration: "none",
        }}
      >
        Admin
      </Link>
    </header>
  );
}
