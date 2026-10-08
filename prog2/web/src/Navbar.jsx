import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import logo from "../logo/logo.ico";
import { useColoresPlanilla } from "./ColoresPlanilla.jsx";
import { iniciarRecorrido } from "./Recorrido.jsx";

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [parametros, setParametros] = useSearchParams();
  const [codigo, setCodigo] = useState("");
  const [resultados, setResultados] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState("");
  const caja = useRef(null);

  useEffect(() => {
    const consulta = codigo.trim();
    if (consulta.length < 2) {
      setResultados([]);
      setAviso("");
      return undefined;
    }
    const controlador = new AbortController();
    const espera = setTimeout(() => {
      fetch(`/api/buscar?q=${encodeURIComponent(consulta)}`, { signal: controlador.signal })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          setResultados(data.resultados || []);
          setAviso((data.resultados || []).length ? "" : "Sin resultados.");
          setAbierto(true);
        })
        .catch((error) => {
          if (error.name === "AbortError") return;
          setResultados([]);
          setAviso("No se pudo buscar.");
          setAbierto(true);
        });
    }, 200);
    return () => {
      clearTimeout(espera);
      controlador.abort();
    };
  }, [codigo]);

  useEffect(() => {
    function cerrar(event) {
      if (caja.current && !caja.current.contains(event.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  function limpiarBusqueda() {
    setCodigo("");
    setResultados([]);
    setAviso("");
    setAbierto(false);
    if (parametros.get("q")) {
      const siguientes = new URLSearchParams(parametros);
      siguientes.delete("q");
      setParametros(siguientes);
    }
  }

  function abrirMaterial(valor) {
    const buscado = String(valor ?? "").trim();
    if (!buscado) return;
    setAbierto(false);
    setCodigo("");
    navigate(`/${encodeURIComponent(buscado)}`);
  }
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
          if (buscado.length < 2) {
            abrirMaterial(buscado);
            return;
          }
          setAbierto(false);
          navigate(`/?q=${encodeURIComponent(buscado)}`);
        }}
        data-tour="buscar"
        className="barra-buscar"
        ref={caja}
        style={{ display: "flex", gap: 8, marginLeft: "auto", flex: "0 1 auto", minWidth: 0, position: "relative" }}
      >
        <span style={{ position: "relative", display: "inline-flex", minWidth: 220 }}>
          <input
            value={codigo}
            onChange={(event) => setCodigo(event.target.value)}
            onFocus={() => {
              if (codigo.trim().length >= 2) setAbierto(true);
            }}
            placeholder="Código o nombre"
            aria-label="Código o nombre de material"
            autoComplete="off"
            style={{
              width: "100%",
              padding: codigo ? "8px 32px 8px 12px" : "8px 12px",
              borderRadius: 6,
              fontSize: 14,
              minWidth: 220,
              boxSizing: "border-box",
            }}
          />
          {codigo && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={limpiarBusqueda}
              style={{
                position: "absolute",
                top: "50%",
                right: 6,
                transform: "translateY(-50%)",
                width: 22,
                height: 22,
                padding: 0,
                border: 0,
                borderRadius: "50%",
                background: "transparent",
                color: "var(--texto)",
                fontSize: 16,
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          )}
        </span>
        {abierto && (resultados.length > 0 || aviso) && (
          <ul
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 48,
              margin: 0,
              padding: 4,
              listStyle: "none",
              background: "var(--superficie)",
              border: "1px solid var(--borde)",
              borderRadius: 6,
              maxHeight: 280,
              overflowY: "auto",
              zIndex: 20,
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
            }}
          >
            {aviso && resultados.length === 0 && (
              <li style={{ padding: "8px 10px", fontSize: 14, color: "var(--texto)" }}>{aviso}</li>
            )}
            {resultados.map((item) => (
              <li key={item.codigo}>
                <button
                  type="button"
                  onClick={() => abrirMaterial(item.codigo)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    border: 0,
                    borderRadius: 4,
                    background: "transparent",
                    color: "var(--texto)",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  <strong>{item.codigo}</strong>
                  {item.descripcion ? ` — ${item.descripcion}` : ""}
                </button>
              </li>
            ))}
          </ul>
        )}
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
