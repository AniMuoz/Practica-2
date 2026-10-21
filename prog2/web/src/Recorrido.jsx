import { useCallback, useEffect, useState } from "react";

const PASOS = {
  principal: [
    {
      id: "titulo",
      titulo: "Volver al inicio",
      texto: "Al presionar el título del programa vuelves a la planilla principal.",
    },
    {
      id: "colores",
      titulo: "Colores",
      texto: "Está encendido por defecto. Si lo apagas, las tablas y planillas se muestran sin colores.",
    },
    {
      id: "oscuro",
      titulo: "Modo oscuro",
      texto: "Está apagado por defecto. Al activarlo la página pasa a tonos negros, grises y verde agua.",
    },
    {
      id: "buscar",
      titulo: "Buscar un material",
      texto: "Escribe un código o parte del nombre y elige el material para abrir su página.",
    },
    {
      id: "filtros",
      titulo: "Filtros",
      texto: "Aquí puedes ordenar y filtrar la planilla. La descarga usa los filtros que estén activos.",
    },
    {
      id: "descargar",
      titulo: "Descargar planilla",
      texto: "Descarga la planilla según los filtros colocados.",
    },
    {
      id: "limpiar",
      titulo: "Nuevo inventario",
      texto: "Vacía las columnas de inventario y comentario para empezar de cero. Pide la contraseña de acceso.",
    },
    {
      id: "planilla",
      titulo: "Planilla",
      texto:
        "Muestra los datos de los materiales. Al presionar una fila se abre la página de ese material. Colores: inventario igual al stock pinta inventario y comentario en verde; si es mayor o menor, en rojo; si hay comentario, en naranja. Si el stock es igual o menor al stock critico, la fila se ve amarilla.",
    },
  ],
  material: [
    {
      id: "material",
      titulo: "Página del material",
      texto: "Aquí se ven los detalles del material que elegiste en la planilla.",
    },
    {
      id: "ocultar-imagenes",
      titulo: "Ocultar imágenes",
      texto: "Oculta las imágenes para que no estorben al contar.",
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
      texto: "Esta sección solo se abre con la contraseña de acceso.",
    },
    {
      id: "Añadir/cargar datos",
      titulo: "Añadir o cargar datos",
      texto:
        "Añade un dato de la base de inventario o actualiza las bases con archivos oficiales, planillas anteriores o una tabla de una sola columna. También se pueden actualizar las reservas.",
    },
    {
      id: "Bitacora camion",
      titulo: "Bitácora de camiones",
      texto:
        "Abre la bitácora de camiones. Ahí se consultan o crean folios y se registran los viajes: fecha, chofer, patente, ruta, horarios, kilómetros y firma. Cada cambio que hagas queda registrado con tu usuario y se ve en Auditoría.",
    },
    {
      id: "bitacora-buscador",
      titulo: "Buscar o generar un folio",
      texto:
        "Escribe un número y presiona Consultar folio para abrirlo, o usa Generar nuevo folio. El número del último folio es un enlace: púlsalo para abrirlo directo.",
    },
    {
      id: "bitacora-acciones",
      titulo: "Acciones del folio",
      texto:
        "Muestra el folio abierto, cuántas filas tiene y si los cambios ya están guardados. Añadir fila agrega un viaje, Descargar planilla baja el Excel y Eliminar folio pide una doble confirmación.",
    },
    {
      id: "bitacora-tabla",
      titulo: "Tabla de viajes",
      texto:
        "Las columnas están agrupadas por color: Viaje, Horarios, Kilometraje, Detalle y Firma. Cada celda se guarda sola al salir de ella y KM/RECO se calcula. Al subir la imagen de la firma hay que confirmar el RUT de la fila: queda Vigente, y si después cambian los datos del viaje pasa a Vencida. Para quitarla hay que indicar un motivo, que queda en el historial de Auditoría y no sale en el Excel.",
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
      texto: "Revisa una reserva por número de orden o subiendo la orden, para ver si hay stock para cubrirla.",
    },
    {
      id: "Planilla de ventas",
      titulo: "Planilla de ventas",
      texto: "Genera o continúa una planilla de ventas. Puedes subir una orden, un traspaso o cargar producto a producto. Puedes elegir un contratista de la lista.",
    },
    {
      id: "Editar contratistas",
      titulo: "Contratistas",
      texto: "Edita la lista de contratistas que se pueden elegir al cargar una orden de venta.",
    },
  ],
  personal: [
    {
      id: "personal-crear",
      titulo: "Crear usuario",
      texto:
        "Escribe el nombre de usuario, la contraseña inicial y repítela. Elige el rol: Operador o Admin. Luego presiona Crear usuario.",
    },
    {
      id: "personal-tabla",
      titulo: "Lista de personal",
      texto: "Muestra todos los usuarios con su rol y la fecha de alta.",
    },
    {
      id: "personal-acciones",
      titulo: "Acciones",
      texto:
        "En cada usuario puedes cambiar su contraseña escribiéndola dos veces, o eliminarlo. Sobre tu propio usuario no hay acciones.",
    },
  ],
  qr: [
    {
      id: "qr-resumen",
      titulo: "Resumen",
      texto: "Muestra cuántos materiales hay según los filtros, cuántos tienen QR y cuántos faltan.",
    },
    {
      id: "qr-avance",
      titulo: "Avance",
      texto: "La barra indica el porcentaje de materiales filtrados que ya tiene QR.",
    },
    {
      id: "qr-acciones",
      titulo: "Acciones",
      texto:
        "Primero ingresa la contraseña de datos para habilitar los botones. Puedes generar y subir los QR que faltan, o descargar un ZIP con los QR de los materiales filtrados. Mientras se suben puedes cancelar.",
    },
    {
      id: "qr-filtros",
      titulo: "Filtros",
      texto: "Limitan los materiales sobre los que se cuentan, suben o descargan los QR.",
    },
  ],
  gastos: [
    {
      id: "gastos-formulario",
      titulo: "Datos de la boleta",
      texto: "Elige un tópico, escribe proveedor, N° de boleta y monto (entero), elige la fecha en el calendario y presiona Agregar para sumarla a la tabla.",
    },
    {
      id: "gastos-acciones",
      titulo: "Acciones",
      texto:
        "Guardar Datos sin procesar descarga las boletas cargadas en un Excel. Recuperar Datos suma las boletas de un Excel guardado antes. Elige el mes y presiona Procesar Datos para descargar el detalle de gastos.",
    },
    {
      id: "gastos-tabla",
      titulo: "Tabla de boletas",
      texto: "Muestra las boletas cargadas. Con la × quitas una fila; Vaciar borra todas. Los datos quedan guardados en este navegador.",
    },
  ],
  auditoria: [
    {
      id: "auditoria-actividad",
      titulo: "Actividad",
      texto:
        "Muestra cada cambio hecho en las bitácoras: fecha y hora, qué usuario lo hizo y qué cambió (por ejemplo, el valor anterior y el nuevo de una celda). Se puede filtrar por usuario, acción, folio y fechas.",
    },
    {
      id: "auditoria-folios",
      titulo: "Folios de bitácora",
      texto:
        "Lista todos los folios, incluso los eliminados, con su fecha de alta, estado y fecha de eliminación. Presiona un folio para ver su detalle.",
    },
    {
      id: "auditoria-filas",
      titulo: "Filas del folio",
      texto: "Al entrar se abre el último folio; presiona otro de la lista para cambiarlo. Muestra los viajes registrados: chofer, patente, ruta, horarios y kilómetros.",
    },
    {
      id: "auditoria-firmas",
      titulo: "Historial de firmas",
      texto:
        "Muestra las firmas que fueron quitadas, con la fecha en que se firmaron y se quitaron, el motivo y una huella de la firma.",
    },
    {
      id: "auditoria-log",
      titulo: "Historial de cambios del folio",
      texto:
        "Lista todo lo que se hizo en este folio, del más reciente al más antiguo, con el usuario que hizo cada cambio. Los cambios de un folio eliminado también se conservan.",
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
