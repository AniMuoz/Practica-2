import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import logo from "../logo/logoberfre.png";
import { useColoresPlanilla } from "./ColoresPlanilla.jsx";
import { useSesion } from "./Acceso.jsx";
import { iniciarRecorrido } from "./Recorrido.jsx";
import { sonarActualizacion, useSonido } from "./sonido.js";

export default function Navbar({ buzonNovedades = 0 }) {
  const { rol, usuario } = useSesion();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [parametros, setParametros] = useSearchParams();
  const [codigo, setCodigo] = useState("");
  const [resultados, setResultados] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState("");
  const [menuVisible, setMenuVisible] = useState(true);
  const caja = useRef(null);
  const campo = useRef(null);
  const barraRef = useRef(null);

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

  function soltarFoco() {
    const quitar = () => {
      campo.current?.blur();
      const activo = document.activeElement;
      if (activo instanceof HTMLElement && activo !== document.body) activo.blur();
    };
    quitar();
    setTimeout(quitar, 0);
  }

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
    soltarFoco();
    navigate(`/${encodeURIComponent(buscado)}`);
  }

  const { colores, cambiarColores, oscuro, cambiarOscuro } = useColoresPlanilla();
  const { sonido, cambiarSonido } = useSonido();
  const [pendientes, setPendientes] = useState(0);
  const pendientesPrevios = useRef(null);

  // Polling + SSE de mensajes sin revisar (solo admin).
  // Cuando el admin está en /buzon, Buzon.jsx también hace su propio polling de novedades
  // y pasa el total via prop buzonNovedades — aquí solo rastreamos los mensajes pendientes.
  useEffect(() => {
    if (rol !== "admin") return undefined;
    let activo = true;
    let pendienteSse = 0;
    function leer() {
      if (document.visibilityState !== "visible") return;
      fetch("/api/buzon/pendientes", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          if (!activo) return;
          const nuevo = Number(data.pendientes) || 0;
          // En /buzon el sonido lo dispara Buzon.jsx al detectar ids nuevos.
          if (
            pathname !== "/buzon" &&
            pendientesPrevios.current !== null &&
            nuevo > pendientesPrevios.current
          ) {
            sonarActualizacion();
          }
          pendientesPrevios.current = nuevo;
          setPendientes(nuevo);
        })
        .catch(() => {});
    }
    leer();
    const intervalo = setInterval(leer, 60000);
    document.addEventListener("visibilitychange", leer);
    const fuente = new EventSource("/api/eventos");
    fuente.onmessage = (evento) => {
      let data;
      try {
        data = JSON.parse(evento.data);
      } catch {
        return;
      }
      if (data.tipo !== "buzon") return;
      window.clearTimeout(pendienteSse);
      pendienteSse = window.setTimeout(leer, 200);
    };
    return () => {
      activo = false;
      clearInterval(intervalo);
      window.clearTimeout(pendienteSse);
      document.removeEventListener("visibilitychange", leer);
      fuente.close();
    };
  }, [rol, pathname, usuario]);

  // Polling de novedades para operador (respuestas del admin en sus mensajes).
  // Solo corre cuando buzonNovedades no viene de prop (es decir, cuando NO estamos en /buzon).
  const [novedadesOperador, setNovedadesOperador] = useState(0);
  const prevNovedadesOp = useRef(0);
  useEffect(() => {
    if (rol === "admin") return undefined;
    // Si ya estamos en /buzon Buzon.jsx gestiona todo, pero aun así mostramos el badge
    // usando la prop. El polling aquí sirve para las OTRAS páginas.
    if (pathname === "/buzon") return undefined;
    let activo = true;
    function leer() {
      if (document.visibilityState !== "visible") return;
      fetch("/api/buzon/novedades", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(({ novedades }) => {
          if (!activo) return;
          // leer vistos desde localStorage
          let vistos = {};
          try { vistos = JSON.parse(localStorage.getItem(`buzon-visto-${usuario}`) || "{}"); } catch { /* noop */ }
          let total = 0;
          for (const [bid, ultimaId] of Object.entries(novedades || {})) {
            if (ultimaId > (vistos[bid] ?? -1)) total += 1;
          }
          if (total > prevNovedadesOp.current) sonarActualizacion();
          prevNovedadesOp.current = total;
          setNovedadesOperador(total);
        })
        .catch(() => {});
    }
    leer();
    const id = setInterval(leer, 15000);
    document.addEventListener("visibilitychange", leer);
    return () => {
      activo = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", leer);
    };
  }, [rol, pathname, usuario]);

  function cerrarSesion() {
    fetch("/api/logout", { method: "POST" })
      .catch(() => {})
      .finally(() => window.dispatchEvent(new Event("sesion-vencida")));
  }

  useLayoutEffect(() => {
    const barra = barraRef.current;
    if (!barra || !barra.parentElement) return undefined;
    function ajustar() {
      barra.style.zoom = "1";
      const disponible = barra.parentElement.clientWidth;
      const natural = barra.scrollWidth;
      if (natural > disponible && disponible > 0) {
        barra.style.zoom = String(Math.max(0.3, (disponible / natural) * 0.995));
      }
    }
    ajustar();
    const observador = new ResizeObserver(ajustar);
    observador.observe(barra.parentElement);
    window.addEventListener("resize", ajustar);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", ajustar);
    };
  }, [menuVisible, rol, colores, oscuro, sonido, codigo]);

  // El badge del Buzón se muestra si:
  //   admin    → hay mensajes sin revisar (pendientes) O hay respuestas nuevas de operadores (buzonNovedades)
  //   operador → hay respuestas nuevas del admin:
  //              · en /buzon  → usa la prop buzonNovedades (gestionada por Buzon.jsx)
  //              · en otras   → usa novedadesOperador (polling propio del Navbar)
  const novedadesEfectivas = pathname === "/buzon" ? buzonNovedades : novedadesOperador;
  const mostrarBadgeBuzon =
    rol === "admin" ? pendientes > 0 || buzonNovedades > 0 : novedadesEfectivas > 0;

  return (
    <header
      className="barra"
      ref={barraRef}
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "nowrap",
        whiteSpace: "nowrap",
        gap: 12,
        marginBottom: 16,
        padding: "10px 14px",
        background: "var(--superficie)",
        borderRadius: 8,
      }}
    >
      <button
        type="button"
        className="barra-salir"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        onClick={cerrarSesion}
        style={{
          width: 32,
          height: 32,
          padding: 0,
          border: 0,
          borderRadius: "50%",
          background: "#d32f2f",
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          cursor: "pointer",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M12 3v9" />
          <path d="M6.3 6.8a8 8 0 1 0 11.4 0" />
        </svg>
      </button>
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
        <img src={logo} alt="BERFRE" style={{ height: 32, width: "auto" }} />
        Bodega Esval Coraceros Viña
      </Link>
      <button
        type="button"
        className="barra-ayuda"
        aria-label="Ayuda"
        onClick={() => iniciarRecorrido(({ "/admin": "admin", "/personal": "personal", "/qr": "qr", "/gastos": "gastos", "/auditoria": "auditoria", "/": "principal" })[pathname] || "material")}
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
        className="barra-sonido"
        aria-label={sonido ? "Silenciar avisos sonoros" : "Activar avisos sonoros"}
        title={sonido ? "Silenciar avisos sonoros" : "Activar avisos sonoros"}
        aria-pressed={sonido}
        onClick={() => cambiarSonido(!sonido)}
        style={{ padding: 0, border: 0, background: "transparent", color: "var(--texto)", cursor: "pointer", lineHeight: 0 }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5 6 9H2v6h4l5 4V5z" />
          {!sonido && <path d="m22 9-6 6M16 9l6 6" />}
        </svg>
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
          soltarFoco();
          navigate(`/?q=${encodeURIComponent(buscado)}`);
        }}
        data-tour="buscar"
        className="barra-buscar"
        ref={caja}
        style={{ display: "flex", gap: 8, marginLeft: "auto", flex: "0 0 auto", minWidth: "max-content", position: "relative" }}
      >
        <span style={{ position: "relative", display: "inline-flex", minWidth: 220 }}>
          <input
            ref={campo}
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
          onMouseDown={(event) => event.preventDefault()}
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
      {menuVisible && (
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
      )}
      {menuVisible && (
        <Link
          to="/buzon"
          className="barra-buzon"
          style={{ padding: "8px 14px", borderRadius: 6, background: "var(--boton)", color: "var(--sobre)", fontSize: 14, textDecoration: "none", flexShrink: 0, position: "relative" }}
        >
          Buzón
          {mostrarBadgeBuzon && (
            <span
              role="status"
              aria-label={
                rol === "admin" && pendientes > 0
                  ? `${pendientes} mensajes sin revisar`
                  : `${buzonNovedades} respuestas nuevas`
              }
              style={{ position: "absolute", top: -4, right: -4, width: 12, height: 12, borderRadius: "50%", background: "#d32f2f", border: "2px solid var(--superficie)", boxSizing: "border-box" }}
            />
          )}
        </Link>
      )}
      {rol === "admin" && menuVisible && (
        <>
          <Link to="/personal" style={{ padding: "8px 14px", borderRadius: 6, background: "var(--boton)", color: "var(--sobre)", fontSize: 14, textDecoration: "none" }}>
            Personal
          </Link>
          <Link to="/qr" style={{ padding: "8px 14px", borderRadius: 6, background: "var(--boton)", color: "var(--sobre)", fontSize: 14, textDecoration: "none" }}>
            QR
          </Link>
          <Link to="/gastos" style={{ padding: "8px 14px", borderRadius: 6, background: "var(--boton)", color: "var(--sobre)", fontSize: 14, textDecoration: "none" }}>
            Gastos
          </Link>
          <Link to="/auditoria" style={{ padding: "8px 14px", borderRadius: 6, background: "var(--boton)", color: "var(--sobre)", fontSize: 14, textDecoration: "none" }}>
            Auditoría
          </Link>
        </>
      )}
      <button
        type="button"
        aria-label={menuVisible ? "Ocultar botones" : "Mostrar botones"}
        title={menuVisible ? "Ocultar botones" : "Mostrar botones"}
        aria-expanded={menuVisible}
        onClick={() => setMenuVisible(!menuVisible)}
        style={{ padding: "8px 10px", border: 0, borderRadius: 6, background: "var(--boton)", color: "var(--sobre)", cursor: "pointer", lineHeight: 0 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: menuVisible ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform 0.2s ease" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </header>
  );
}
