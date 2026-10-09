import { useCallback, useEffect, useState } from "react";

const PASOS = {
  principal: [
    {
      id: "titulo",
      titulo: "Volver al inicio",
      texto: "Al presionar el titulo del programa vuelves a la planilla principal.",
    },
    {
      id: "colores",
      titulo: "Colores",
      texto: "Esta encendido por defecto. Si lo apagas, las tablas y planillas se muestran sin colores.",
    },
    {
      id: "oscuro",
      titulo: "Modo oscuro",
      texto: "Esta apagado por defecto. Al activarlo la pagina pasa a tonos negros, grises y verde agua.",
    },
    {
      id: "buscar",
      titulo: "Buscar un material",
      texto: "Escribe un codigo o parte del nombre y elige el material para abrir su pagina.",
    },
    {
      id: "filtros",
      titulo: "Filtros",
      texto: "Aqui puedes ordenar y filtrar la planilla. La descarga usa los filtros que esten activos.",
    },
    {
      id: "descargar",
      titulo: "Descargar planilla",
      texto: "Descarga la planilla segun los filtros colocados.",
    },
    {
      id: "limpiar",
      titulo: "Nuevo inventario",
      texto: "Vacia las columnas de inventario y comentario para empezar de cero. Pide la contraseña de acceso.",
    },
    {
      id: "planilla",
      titulo: "Planilla",
      texto:
        "Muestra los datos de los materiales. Al presionar una fila se abre la pagina de ese material. Colores: inventario igual al stock pinta inventario y comentario en verde; si es mayor o menor, en rojo; si hay comentario, en naranja. Si el stock es igual o menor al stock critico, la fila se ve amarilla.",
    },
  ],
  material: [
    {
      id: "material",
      titulo: "Pagina del material",
      texto: "Aqui se ven los detalles del material que elegiste en la planilla.",
    },
    {
      id: "ocultar-imagenes",
      titulo: "Ocultar imagenes",
      texto: "Oculta las imagenes para que no estorben al contar.",
    },
    {
      id: "conteo",
      titulo: "Inventario y comentario",
      texto:
        "El recuadro de inventario es la cantidad contada y aparece en la tabla completa. El comentario queda asociado al material. Guarda para que se vea en la planilla.",
    },
    {
      id: "editar-material",
      titulo: "Editar datos",
      texto: "Con la contraseña de acceso se pueden editar los datos del material que se ve.",
    },
  ],
  admin: [
    {
      id: "admin-clave",
      titulo: "Acceso",
      texto: "Esta seccion solo se abre con la contraseña de acceso.",
    },
    {
      id: "Añadir/cargar datos",
      titulo: "Anadir o cargar datos",
      texto:
        "Anade un dato de la base de inventario o actualiza las bases con archivos oficiales, planillas anteriores o una tabla de una sola columna. Tambien se pueden actualizar las reservas.",
    },
    {
      id: "Stock en bodega",
      titulo: "Stock M501",
      texto: "Genera una planilla con el stock de la bodega M501.",
    },
    {
      id: "Stock regional",
      titulo: "Stock de varias bodegas",
      texto: "Genera una planilla con el stock de las bodegas M501, M502, M503, M504 y M505.",
    },
    {
      id: "Planilla de inventario",
      titulo: "Inventario manual",
      texto: "Genera una planilla para hacer el inventario a mano en la bodega M501.",
    },
    {
      id: "Inventario por bodega",
      titulo: "Inventario por lugar",
      texto: "Genera una planilla de inventario manual por cada bodega individual de M501.",
    },
    {
      id: "Stock detallado",
      titulo: "Stock detallado",
      texto: "Genera una planilla detallada del stock, con casillas para revisar y comparar con datos de fuera del sistema.",
    },
    {
      id: "Revisar stock de reserva",
      titulo: "Revisar una reserva",
      texto: "Revisa una reserva por numero de orden o subiendo la orden, para ver si hay stock para cubrirla.",
    },
    {
      id: "Planilla de ventas",
      titulo: "Planilla de ventas",
      texto: "Genera o continua una planilla de ventas. Podés subir una orden, un traspaso o cargar producto a producto. Podés elegir un contratista de la lista.",
    },
    {
      id: "Editar contratistas",
      titulo: "Contratistas",
      texto: "Edita la lista de contratistas que se pueden elegir al cargar una orden de venta.",
    },
  ],
};

function claveVista(nombre) {
  return `tutorial-${nombre}`;
}

export function iniciarRecorrido(nombre) {
  window.dispatchEvent(new CustomEvent("recorrido", { detail: nombre }));
}

export function Recorrido() {
  const [nombre, setNombre] = useState(null);
  const [indice, setIndice] = useState(0);
  const [caja, setCaja] = useState(null);

  const pasos = nombre ? PASOS[nombre] : [];
  const paso = pasos[indice];

  const medir = useCallback(() => {
    if (!paso) {
      setCaja(null);
      return;
    }
    const nodo = document.querySelector(`[data-tour="${CSS.escape(paso.id)}"]`);
    if (!nodo) {
      setCaja(null);
      return;
    }
    nodo.scrollIntoView({ block: "nearest", inline: "nearest" });
    const rect = nodo.getBoundingClientRect();
    setCaja({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, [paso]);

  useEffect(() => {
    function alIniciar(evento) {
      const siguiente = evento.detail;
      if (!PASOS[siguiente]) return;
      setNombre(siguiente);
      setIndice(0);
    }
    window.addEventListener("recorrido", alIniciar);
    return () => window.removeEventListener("recorrido", alIniciar);
  }, []);

  useEffect(() => {
    if (!nombre) return undefined;
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [nombre, indice, medir]);

  useEffect(() => {
    if (!nombre || !paso) return;
    const nodo = document.querySelector(`[data-tour="${CSS.escape(paso.id)}"]`);
    if (nodo) return;
    if (indice < pasos.length - 1) setIndice((actual) => actual + 1);
    else {
      setNombre(null);
      setIndice(0);
      setCaja(null);
    }
  }, [nombre, paso, indice, pasos.length]);

  function cerrar() {
    if (nombre) localStorage.setItem(claveVista(nombre), "1");
    setNombre(null);
    setIndice(0);
    setCaja(null);
  }

  function siguiente() {
    if (indice >= pasos.length - 1) cerrar();
    else setIndice((actual) => actual + 1);
  }

  if (!nombre || !paso || !caja) return null;

  const abajo = caja.top + caja.height + 12;
  const cabeAbajo = abajo + 180 < window.innerHeight;
  const top = cabeAbajo ? abajo : Math.max(12, caja.top - 12);
  const left = Math.min(Math.max(12, caja.left), window.innerWidth - 340);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40 }}>
      <div
        onClick={cerrar}
        style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.45)" }}
      />
      <div
        style={{
          position: "fixed",
          top: caja.top - 4,
          left: caja.left - 4,
          width: caja.width + 8,
          height: caja.height + 8,
          borderRadius: 8,
          outline: "3px solid var(--acento)",
          pointerEvents: "none",
        }}
      />
      <div
        role="dialog"
        aria-label={paso.titulo}
        style={{
          position: "fixed",
          top: cabeAbajo ? top : undefined,
          bottom: cabeAbajo ? undefined : window.innerHeight - top,
          left,
          width: "min(320px, calc(100vw - 24px))",
          background: "var(--superficie)",
          color: "var(--texto)",
          fontFamily: "'Miriam Libre', Miriam, sans-serif",
          borderRadius: 8,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 41,
        }}
      >
        <strong style={{ fontSize: 15 }}>{paso.titulo}</strong>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4 }}>{paso.texto}</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>
            {indice + 1} de {pasos.length}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={cerrar}
              style={{
                padding: "6px 10px",
                border: 0,
                borderRadius: 6,
                background: "var(--apagado)",
                color: "var(--apagado-texto)",
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={siguiente}
              style={{
                padding: "6px 10px",
                border: 0,
                borderRadius: 6,
                background: "var(--acento)",
                color: "var(--sobre)",
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {indice >= pasos.length - 1 ? "Listo" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function recorridoPendiente(nombre) {
  return localStorage.getItem(claveVista(nombre)) !== "1";
}
