const ExcelJS = require("exceljs");
const { supabase } = require("../supabase/supabase");

// Retencion de los logs de auditoria (dias). Los de usuarios y firmas viven el doble.
const RETENCION_DIAS = {
  ventas_log: { dias: 90, columna: "creado_en" },
  bitacora_log: { dias: 90, columna: "creado_en" },
  usuarios_log: { dias: 180, columna: "creado_en" },
  bitacora_firmas_historial: { dias: 180, columna: "quitada_en" },
};

const UN_DIA_MS = 24 * 60 * 60 * 1000;
const LOTE_LECTURA = 1000;
const MAX_FILAS_DESCARGA = 50000;

function fechaCorte(dias, ahora = new Date()) {
  return new Date(ahora.getTime() - dias * UN_DIA_MS).toISOString();
}

// Borra lo que supera la retencion de cada tabla. Un fallo en una tabla no impide limpiar las demas.
async function limpiarLogs(cliente = supabase, ahora = new Date()) {
  const resultado = {};
  for (const [tabla, { dias, columna }] of Object.entries(RETENCION_DIAS)) {
    try {
      const { error, count } = await cliente.from(tabla).delete({ count: "exact" }).lt(columna, fechaCorte(dias, ahora));
      if (error) throw error;
      resultado[tabla] = count ?? 0;
    } catch (error) {
      console.error(`No se pudo limpiar ${tabla}:`, error.message || error);
      resultado[tabla] = null;
    }
  }
  return resultado;
}

// Se limpia al arrancar y despues una vez al dia: el servidor puede reiniciarse o dormir, asi que no se
// confia en un calendario fijo. Como se borra por antiguedad, correr a diario equivale a cumplir 90/180 dias.
function programarLimpieza(cliente = supabase, cada = UN_DIA_MS) {
  const ejecutar = () =>
    limpiarLogs(cliente)
      .then((r) => console.log("Limpieza de logs:", JSON.stringify(r)))
      .catch((error) => console.error("Fallo la limpieza de logs:", error.message));
  ejecutar();
  const temporizador = setInterval(ejecutar, cada);
  temporizador.unref();
  return temporizador;
}

// Lee todas las filas que cumplen la consulta, por tramos (Supabase corta cada respuesta en 1000).
async function leerTodo(construir, falloBd) {
  const filas = [];
  while (filas.length < MAX_FILAS_DESCARGA) {
    const { data, error } = await construir().range(filas.length, filas.length + LOTE_LECTURA - 1);
    if (error) falloBd(error);
    filas.push(...(data || []));
    if (!data || data.length < LOTE_LECTURA) break;
  }
  return filas;
}

const formatoFecha = (valor) => (valor ? new Date(valor).toLocaleString("es-CL", { timeZone: "America/Santiago" }) : "");

async function generarExcelLog(hoja, columnas, filas) {
  const libro = new ExcelJS.Workbook();
  const hojaLibro = libro.addWorksheet(hoja);
  hojaLibro.columns = columnas.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho || 18 }));
  hojaLibro.getRow(1).font = { bold: true };
  hojaLibro.views = [{ state: "frozen", ySplit: 1 }];
  for (const fila of filas) {
    hojaLibro.addRow(
      Object.fromEntries(
        columnas.map((c) => {
          const valor = c.clave === "creado_en" ? formatoFecha(fila.creado_en) : fila[c.clave];
          return [c.clave, c.formato ? c.formato(valor, fila) : valor ?? ""];
        }),
      ),
    );
  }
  return libro.xlsx.writeBuffer();
}

const detalleTexto = (valor) => (valor && Object.keys(valor).length ? JSON.stringify(valor) : "");

module.exports = {
  RETENCION_DIAS,
  fechaCorte,
  limpiarLogs,
  programarLimpieza,
  leerTodo,
  generarExcelLog,
  detalleTexto,
  MAX_FILAS_DESCARGA,
};
