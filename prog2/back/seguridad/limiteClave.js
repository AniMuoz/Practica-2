const { AsyncLocalStorage } = require("async_hooks");
const { ipDe } = require("./seguridad");

// Limite de intentos de la clave compartida (CLAVE_DATOS): 3 fallos por IP bloquean 15 minutos.
// Va por IP y no por usuario/rol, asi que protege tambien las peticiones sin sesion.
const MAX_FALLOS = 3;
const BLOQUEO_MS = 15 * 60 * 1000;
const MENSAJE = "Demasiados intentos con la clave. Espera 15 minutos para volver a intentar.";

const contexto = new AsyncLocalStorage();
const registros = new Map();
let ahora = () => Date.now();

function estaBloqueada(ip) {
  const registro = registros.get(ip);
  if (!registro) return false;
  if (ahora() - registro.desde > BLOQUEO_MS) {
    registros.delete(ip);
    return false;
  }
  return registro.cantidad >= MAX_FALLOS;
}

function limpiarVencidos() {
  const limite = ahora() - BLOQUEO_MS;
  for (const [ip, registro] of registros) if (registro.desde < limite) registros.delete(ip);
}

// Middleware: deja la IP disponible para claveCorrecta() durante toda la peticion.
function conIpDeClave(req, _res, next) {
  contexto.run({ ip: ipDe(req) }, next);
}

// Se llama desde claveCorrecta(). Fuera de una peticion HTTP (tests, scripts) no limita nada.
function controlarIntento(esCorrecta) {
  const datos = contexto.getStore();
  if (!datos) return esCorrecta;
  if (estaBloqueada(datos.ip)) {
    const error = new Error(MENSAJE);
    error.status = 429;
    throw error;
  }
  if (esCorrecta) {
    registros.delete(datos.ip);
    return true;
  }
  const registro = registros.get(datos.ip);
  if (!registro) {
    if (registros.size > 5000) limpiarVencidos();
    registros.set(datos.ip, { desde: ahora(), cantidad: 1 });
  } else {
    registro.cantidad += 1;
    registro.desde = ahora();
  }
  return false;
}

function reiniciar(reloj) {
  registros.clear();
  ahora = reloj || (() => Date.now());
}

module.exports = { conIpDeClave, controlarIntento, reiniciar, MAX_FALLOS, BLOQUEO_MS, MENSAJE, contexto };
