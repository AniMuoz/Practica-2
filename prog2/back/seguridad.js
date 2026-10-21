const crypto = require("crypto");
const cors = require("cors");

const VENTANA_MS = 60 * 1000;
const MAX_PETICIONES = Number(process.env.RATE_LIMIT_POR_MINUTO) || 600;
const MAX_EVENTOS = Number(process.env.MAX_CONEXIONES_EVENTOS) || 100;

// El front llama a /api en su mismo dominio (el Worker de Cloudflare hace de proxy hacia Render),
// asi que el navegador no necesita CORS. Solo se habilitan los origenes listados en ALLOWED_ORIGINS.
function middlewareCors() {
  const permitidos = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origen) => origen.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (permitidos.length === 0) return (_req, _res, next) => next();
  return cors({
    origin: (origen, cb) => cb(null, !origen || permitidos.includes(origen)),
    credentials: true,
  });
}

function cabecerasSeguras(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Strict-Transport-Security", "max-age=15552000");
  res.removeHeader("X-Powered-By");
  next();
}

function exigirProxy(req, res, next) {
  const esperado = String(process.env.SECRETO_PROXY || "").trim();
  if (!esperado || req.path === "/healthz") {
    next();
    return;
  }
  const recibido = String(req.get("x-secreto-proxy") || "").trim();
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(403).json({ error: "Origen no autorizado." });
    return;
  }
  next();
}

function enProduccion() {
  return Boolean(process.env.RENDER || process.env.NODE_ENV === "production");
}

// En produccion el arranque falla si faltan los secretos: sin ellos la API quedaria abierta
// a llamadas directas a Render o con sesiones que no sobreviven a un reinicio.
function verificarEntorno() {
  if (!enProduccion()) return;
  const faltan = ["SECRETO_PROXY", "SESSION_SECRET"].filter((nombre) => !String(process.env[nombre] || "").trim());
  if (faltan.length > 0) throw new Error(`Faltan variables de entorno obligatorias en produccion: ${faltan.join(", ")}.`);
}

function ipDe(req) {
  // Con SECRETO_PROXY la peticion ya paso por el Worker (exigirProxy): solo se confia en la IP que
  // pone Cloudflare. x-forwarded-for lo puede escribir el cliente, asi que se ignora.
  if (String(process.env.SECRETO_PROXY || "").trim()) {
    const cf = String(req.headers["cf-connecting-ip"] || "").split(",")[0].trim();
    return cf || String(req.ip || "");
  }
  return String(req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip || "")
    .split(",")[0]
    .trim();
}

function limitarPeticiones(req, res, next) {
  if (req.path === "/eventos") {
    next();
    return;
  }
  const ahora = Date.now();
  const clave = ipDe(req);
  let registro = contadores.get(clave);
  if (!registro || ahora - registro.desde > VENTANA_MS) {
    registro = { desde: ahora, cantidad: 0 };
    contadores.set(clave, registro);
  }
  registro.cantidad += 1;
  if (registro.cantidad > MAX_PETICIONES) {
    res.setHeader("Retry-After", String(Math.ceil((registro.desde + VENTANA_MS - ahora) / 1000)));
    res.status(429).json({ error: "Demasiadas peticiones. Espera un momento." });
    return;
  }
  next();
}

const contadores = new Map();
setInterval(() => {
  const limite = Date.now() - VENTANA_MS;
  for (const [clave, registro] of contadores) {
    if (registro.desde < limite) contadores.delete(clave);
  }
}, VENTANA_MS).unref();

module.exports = { middlewareCors, cabecerasSeguras, limitarPeticiones, exigirProxy, ipDe, verificarEntorno, MAX_EVENTOS };
