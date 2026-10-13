const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { supabase } = require("./supabase");

const ARCHIVO_SECRETO = path.join(__dirname, ".sesion-secreto");
const NOMBRE_COOKIE = "sesion";
const DURACION_MS = 7 * 24 * 60 * 60 * 1000;
const RENOVAR_BAJO_MS = 6 * 24 * 60 * 60 * 1000;
const MAX_INTENTOS = 10;
const VENTANA_INTENTOS_MS = 15 * 60 * 1000;
const CACHE_USUARIO_MS = 30 * 1000;
const LARGO_MINIMO_CLAVE = 8;
const RUTAS_PUBLICAS = new Set(["/login", "/logout", "/sesion", "/cambiar-clave"]);

function errorHttp(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function falloBd(error) {
  if (error.code === "PGRST205" || error.code === "42P01") {
    throw errorHttp(503, "En Supabase falta la tabla usuarios. Ejecuta prog2/back/esquema.sql en el SQL Editor.");
  }
  throw errorHttp(502, error.message);
}

const cacheUsuarios = new Map();

async function buscarUsuario(nombre) {
  const guardado = cacheUsuarios.get(nombre);
  if (guardado && guardado.hasta > Date.now()) return guardado.registro;
  const { data, error } = await supabase.from("usuarios").select("usuario, clave_hash").eq("usuario", nombre).maybeSingle();
  if (error) falloBd(error);
  cacheUsuarios.set(nombre, { registro: data, hasta: Date.now() + CACHE_USUARIO_MS });
  return data;
}

async function contarUsuarios() {
  const { count, error } = await supabase.from("usuarios").select("usuario", { count: "exact", head: true });
  if (error) falloBd(error);
  return count || 0;
}

function hashClave(clave, sal = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(clave), sal, 64).toString("hex");
  return `${sal}:${hash}`;
}

function claveValida(clave, guardado) {
  const [sal, hash] = String(guardado || "").split(":");
  if (!sal || !hash) return false;
  const esperado = Buffer.from(hash, "hex");
  const obtenido = crypto.scryptSync(String(clave), sal, esperado.length);
  return crypto.timingSafeEqual(esperado, obtenido);
}

function validarClaveNueva(clave) {
  if (String(clave || "").length < LARGO_MINIMO_CLAVE) {
    throw errorHttp(400, `La contraseña nueva debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`);
  }
}

async function guardarUsuario(nombre, clave) {
  validarClaveNueva(clave);
  const usuario = String(nombre).trim().toLowerCase();
  const { error } = await supabase.from("usuarios").upsert({ usuario, clave_hash: hashClave(clave) }, { onConflict: "usuario" });
  if (error) falloBd(error);
  cacheUsuarios.delete(usuario);
  return usuario;
}

function obtenerSecreto() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  try {
    return fs.readFileSync(ARCHIVO_SECRETO, "utf8").trim();
  } catch {
    const nuevo = crypto.randomBytes(48).toString("hex");
    fs.writeFileSync(ARCHIVO_SECRETO, nuevo, { mode: 0o600 });
    return nuevo;
  }
}

let secretoCache = null;
function secreto() {
  if (!secretoCache) secretoCache = obtenerSecreto();
  return secretoCache;
}

function firmar(texto) {
  return crypto.createHmac("sha256", secreto()).update(texto).digest("base64url");
}

function versionDe(registro) {
  return String(registro.clave_hash).split(":")[0];
}

function crearToken(registro) {
  const cuerpo = Buffer.from(
    JSON.stringify({ u: registro.usuario, v: versionDe(registro), exp: Date.now() + DURACION_MS })
  ).toString("base64url");
  return `${cuerpo}.${firmar(cuerpo)}`;
}

function leerToken(token) {
  const [cuerpo, firma] = String(token || "").split(".");
  if (!cuerpo || !firma) return null;
  const esperada = Buffer.from(firmar(cuerpo));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) return null;
  try {
    const datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8"));
    if (typeof datos.u !== "string" || typeof datos.exp !== "number" || datos.exp < Date.now()) return null;
    return datos;
  } catch {
    return null;
  }
}

function leerCookie(req, nombre) {
  const cabecera = req.headers.cookie || "";
  for (const parte of cabecera.split(";")) {
    const indice = parte.indexOf("=");
    if (indice > 0 && parte.slice(0, indice).trim() === nombre) {
      return decodeURIComponent(parte.slice(indice + 1).trim());
    }
  }
  return "";
}

function esHttps(req) {
  return req.secure || req.headers["x-forwarded-proto"] === "https";
}

function ponerCookie(req, res, token, maxAgeMs) {
  const partes = [
    `${NOMBRE_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (esHttps(req)) partes.push("Secure");
  res.append("Set-Cookie", partes.join("; "));
}

const intentos = new Map();

function clienteDe(req) {
  return String(req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
}

function bloqueado(clave) {
  const registro = intentos.get(clave);
  if (!registro) return false;
  if (Date.now() - registro.desde > VENTANA_INTENTOS_MS) {
    intentos.delete(clave);
    return false;
  }
  return registro.cantidad >= MAX_INTENTOS;
}

function registrarFallo(clave) {
  const registro = intentos.get(clave);
  if (!registro || Date.now() - registro.desde > VENTANA_INTENTOS_MS) {
    intentos.set(clave, { desde: Date.now(), cantidad: 1 });
  } else {
    registro.cantidad += 1;
  }
}

async function sesionDe(req) {
  const datos = leerToken(leerCookie(req, NOMBRE_COOKIE));
  if (!datos) return null;
  const registro = await buscarUsuario(datos.u);
  if (!registro || versionDe(registro) !== datos.v) return null;
  return { datos, registro };
}

function responderError(res, error, mensaje) {
  console.error(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : mensaje });
}

async function protegerApi(req, res, next) {
  if (RUTAS_PUBLICAS.has(req.path)) {
    next();
    return;
  }
  try {
    const sesion = await sesionDe(req);
    if (!sesion) {
      res.status(401).json({ error: "Sesión no iniciada." });
      return;
    }
    req.usuario = sesion.registro.usuario;
    if (sesion.datos.exp - Date.now() < RENOVAR_BAJO_MS) {
      ponerCookie(req, res, crearToken(sesion.registro), DURACION_MS);
    }
    next();
  } catch (error) {
    responderError(res, error, "No se pudo verificar la sesión.");
  }
}

function rutasAuth(app) {
  app.post("/api/login", async (req, res) => {
    try {
      const usuario = String((req.body && req.body.usuario) || "").trim().toLowerCase();
      const clave = String((req.body && req.body.clave) || "");
      const llave = clienteDe(req);
      if (bloqueado(llave)) throw errorHttp(429, "Demasiados intentos. Espera unos minutos.");
      const registro = await buscarUsuario(usuario);
      const correcta = registro ? claveValida(clave, registro.clave_hash) : (hashClave(clave), false);
      if (!correcta) {
        registrarFallo(llave);
        throw errorHttp(401, "Usuario o contraseña incorrectos.");
      }
      intentos.delete(llave);
      ponerCookie(req, res, crearToken(registro), DURACION_MS);
      res.json({ usuario: registro.usuario });
    } catch (error) {
      responderError(res, error, "No se pudo iniciar sesión.");
    }
  });

  app.post("/api/cambiar-clave", async (req, res) => {
    try {
      const usuario = String((req.body && req.body.usuario) || "").trim().toLowerCase();
      const claveActual = String((req.body && req.body.claveActual) || "");
      const claveNueva = String((req.body && req.body.claveNueva) || "");
      const llave = clienteDe(req);
      if (bloqueado(llave)) throw errorHttp(429, "Demasiados intentos. Espera unos minutos.");
      const registro = await buscarUsuario(usuario);
      const correcta = registro ? claveValida(claveActual, registro.clave_hash) : (hashClave(claveActual), false);
      if (!correcta) {
        registrarFallo(llave);
        throw errorHttp(401, "Usuario o contraseña actual incorrectos.");
      }
      validarClaveNueva(claveNueva);
      if (claveNueva === claveActual) throw errorHttp(400, "La contraseña nueva debe ser distinta de la actual.");
      intentos.delete(llave);
      await guardarUsuario(usuario, claveNueva);
      const actualizado = { usuario, clave_hash: (await buscarUsuario(usuario)).clave_hash };
      ponerCookie(req, res, crearToken(actualizado), DURACION_MS);
      res.json({ ok: true, usuario });
    } catch (error) {
      responderError(res, error, "No se pudo cambiar la contraseña.");
    }
  });

  app.post("/api/logout", (req, res) => {
    ponerCookie(req, res, "", 0);
    res.json({ ok: true });
  });

  app.get("/api/sesion", async (req, res) => {
    try {
      const sesion = await sesionDe(req);
      if (!sesion) throw errorHttp(401, "Sesión no iniciada.");
      res.json({ usuario: sesion.registro.usuario });
    } catch (error) {
      responderError(res, error, "No se pudo verificar la sesión.");
    }
  });
}

module.exports = { protegerApi, rutasAuth, guardarUsuario, contarUsuarios };
