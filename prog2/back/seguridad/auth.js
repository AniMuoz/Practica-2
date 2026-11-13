const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { supabase } = require("../supabase/supabase");
const { ipDe: clienteDe } = require("./seguridad");

const ARCHIVO_SECRETO = path.join(__dirname, "..", ".sesion-secreto");
const NOMBRE_COOKIE = "sesion";
// Tope absoluto de la sesion desde el login (no se extiende con el uso).
const DURACION_MS = 8 * 60 * 60 * 1000;
// Sin actividad real del usuario durante este tiempo la sesion se cierra.
const INACTIVIDAD_MS = 60 * 60 * 1000;
const MAX_INTENTOS = 10;
// Limite por nombre de usuario (frena ataques repartidos entre muchas IPs); mas alto para que
// un tercero no pueda bloquear facilmente a un usuario legitimo.
const MAX_INTENTOS_USUARIO = 30;
const VENTANA_INTENTOS_MS = 15 * 60 * 1000;
const CACHE_USUARIO_MS = 30 * 1000;
const MAX_LARGO_USUARIO = 64;
const MAX_LARGO_CLAVE = 256;
const MAX_CACHE_USUARIOS = 500;
const MAX_REGISTROS_INTENTOS = 5000;
const LARGO_MINIMO_CLAVE = 8;
const MENSAJE_DESACTIVADA = "Cuenta desactivada, contactese con un administrador";
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
  console.error(error);
  throw errorHttp(502, "No se pudo consultar la base de datos.");
}

const cacheUsuarios = new Map();

// Tope de memoria: se descartan primero las entradas vencidas y, si sigue lleno, las mas antiguas.
function recortar(mapa, maximo, vencida) {
  if (mapa.size < maximo) return;
  for (const [clave, valor] of mapa) if (vencida(valor)) mapa.delete(clave);
  while (mapa.size >= maximo) mapa.delete(mapa.keys().next().value);
}

function datosValidos(usuario, clave) {
  return usuario.length > 0 && usuario.length <= MAX_LARGO_USUARIO && String(clave).length <= MAX_LARGO_CLAVE;
}

async function buscarUsuario(nombre) {
  const guardado = cacheUsuarios.get(nombre);
  if (guardado && guardado.hasta > Date.now()) return guardado.registro;
  const { data, error } = await supabase.from("usuarios").select("usuario, clave_hash, rol, sesion_version, bodega").eq("usuario", nombre).maybeSingle();
  if (error) falloBd(error);
  recortar(cacheUsuarios, MAX_CACHE_USUARIOS, (v) => v.hasta <= Date.now());
  cacheUsuarios.set(nombre, { registro: data, hasta: Date.now() + CACHE_USUARIO_MS });
  return data;
}

async function contarUsuarios() {
  const { count, error } = await supabase.from("usuarios").select("usuario", { count: "exact", head: true });
  if (error) falloBd(error);
  return count || 0;
}

function scrypt(clave, sal, largo) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(clave), sal, largo, (error, hash) => (error ? reject(error) : resolve(hash)));
  });
}

async function hashClave(clave, sal = crypto.randomBytes(16).toString("hex")) {
  const hash = (await scrypt(clave, sal, 64)).toString("hex");
  return `${sal}:${hash}`;
}

async function claveValida(clave, guardado) {
  const [sal, hash] = String(guardado || "").split(":");
  if (!sal || !hash) return false;
  const esperado = Buffer.from(hash, "hex");
  const obtenido = await scrypt(clave, sal, esperado.length);
  if (esperado.length !== obtenido.length) return false;
  return crypto.timingSafeEqual(esperado, obtenido);
}

function validarClaveNueva(clave) {
  if (String(clave || "").length < LARGO_MINIMO_CLAVE) {
    throw errorHttp(400, `La contraseña nueva debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`);
  }
}

async function guardarUsuario(nombre, clave, rol) {
  validarClaveNueva(clave);
  const usuario = String(nombre).trim().toLowerCase();
  const { error } = await supabase.from("usuarios").upsert({ usuario, clave_hash: await hashClave(clave), ...(rol ? { rol } : {}) }, { onConflict: "usuario" });
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
    if (process.env.RENDER || process.env.NODE_ENV === "production") {
      console.warn("Falta SESSION_SECRET: el secreto se guarda en disco efimero y las sesiones se cerraran en cada reinicio. Defínelo en las variables de entorno de Render.");
    }
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

// Contador de sesion: sube al cerrar sesion y anula todos los tokens emitidos antes.
function contadorDe(registro) {
  return Number(registro.sesion_version) || 0;
}

// `ini` fija el tope de 8h y no cambia al renovar; `act` es la ultima actividad real del usuario.
function crearToken(registro, ini = Date.now()) {
  const cuerpo = Buffer.from(
    JSON.stringify({ u: registro.usuario, v: versionDe(registro), s: contadorDe(registro), ini, act: Date.now() })
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
    if (typeof datos.u !== "string" || typeof datos.ini !== "number" || typeof datos.act !== "number") return null;
    const ahora = Date.now();
    if (ahora - datos.ini > DURACION_MS || ahora - datos.act > INACTIVIDAD_MS) return null;
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

function bloqueado(clave, maximo = MAX_INTENTOS) {
  const registro = intentos.get(clave);
  if (!registro) return false;
  if (Date.now() - registro.desde > VENTANA_INTENTOS_MS) {
    intentos.delete(clave);
    return false;
  }
  return registro.cantidad >= maximo;
}

function registrarFallo(clave) {
  const registro = intentos.get(clave);
  if (!registro) recortar(intentos, MAX_REGISTROS_INTENTOS, (v) => Date.now() - v.desde > VENTANA_INTENTOS_MS);
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
  if (!registro || versionDe(registro) !== datos.v || contadorDe(registro) !== (Number(datos.s) || 0)) return null;
  return { datos, registro };
}

function responderError(res, error, mensaje) {
  console.error(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : mensaje });
}

async function registrarCambioUsuario(actor, evento) {
  try {
    const { error } = await supabase.from("usuarios_log").insert({
      actor: String(actor || ""),
      objetivo: evento.objetivo,
      accion: evento.accion,
      rol_anterior: evento.rol_anterior ?? null,
      rol_nuevo: evento.rol_nuevo ?? null,
    });
    if (error) console.error("No se pudo registrar el cambio de usuario:", error);
  } catch (error) {
    console.error("No se pudo registrar el cambio de usuario:", error);
  }
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
    if (sesion.registro.rol === "desactivado") {
      res.status(403).json({ error: MENSAJE_DESACTIVADA, desactivada: true });
      return;
    }
    req.usuario = sesion.registro.usuario;
    req.rol = sesion.registro.rol;
    req.bodega = sesion.registro.bodega || "M501";
    // Solo las peticiones con actividad real del usuario renuevan; sondeos y SSE no.
    if (req.headers["x-actividad"] === "1") {
      const restante = Math.max(0, sesion.datos.ini + DURACION_MS - Date.now());
      ponerCookie(req, res, crearToken(sesion.registro, sesion.datos.ini), restante);
    }
    next();
  } catch (error) {
    responderError(res, error, "No se pudo verificar la sesión.");
  }
}

async function exigirAdmin(req) {
  if (!req.usuario) throw errorHttp(401, "Sesión no iniciada.");
  const registro = await buscarUsuario(req.usuario);
  if (!registro || registro.rol !== "admin") throw errorHttp(403, "Solo un administrador puede hacer esto.");
  return registro;
}

// Admin o admin externo (el externo solo ve y opera en las excepciones que permite soloAdmin.js).
async function exigirAdminVer(req) {
  if (!req.usuario) throw errorHttp(401, "Sesión no iniciada.");
  const registro = await buscarUsuario(req.usuario);
  if (!registro || (registro.rol !== "admin" && registro.rol !== "admin_ext")) {
    throw errorHttp(403, "Solo un administrador puede hacer esto.");
  }
  return registro;
}

// M501 o admin externo (bitacora de camiones, auditoria).
async function exigirAdminM501oExt(req) {
  const registro = await exigirAdminVer(req);
  if (registro.rol !== "admin_ext" && (registro.bodega || "M501") !== "M501") {
    throw errorHttp(403, "Solo un administrador de M501 puede hacer esto.");
  }
  return registro;
}

async function exigirAdminM501(req) {
  const registro = await exigirAdmin(req);
  if ((registro.bodega || "M501") !== "M501") {
    throw errorHttp(403, "Solo un administrador de M501 puede hacer esto.");
  }
  return registro;
}

function rutasAuth(app) {
  app.post("/api/login", async (req, res) => {
    try {
      const usuario = String((req.body && req.body.usuario) || "").trim().toLowerCase();
      const clave = String((req.body && req.body.clave) || "");
      const llave = clienteDe(req);
      if (!datosValidos(usuario, clave)) {
        registrarFallo(llave);
        throw errorHttp(401, "Usuario o contraseña incorrectos.");
      }
      const llaveUsuario = `usuario:${usuario}`;
      if (bloqueado(llave) || bloqueado(llaveUsuario, MAX_INTENTOS_USUARIO)) throw errorHttp(429, "Demasiados intentos. Espera unos minutos.");
      const registro = await buscarUsuario(usuario);
      const correcta = registro ? await claveValida(clave, registro.clave_hash) : await hashClave(clave).then(() => false);
      if (!correcta) {
        registrarFallo(llave);
        registrarFallo(llaveUsuario);
        throw errorHttp(401, "Usuario o contraseña incorrectos.");
      }
      if (registro.rol === "desactivado") throw errorHttp(403, MENSAJE_DESACTIVADA);
      intentos.delete(llave);
      intentos.delete(llaveUsuario);
      ponerCookie(req, res, crearToken(registro), DURACION_MS);
      res.json({ usuario: registro.usuario, rol: registro.rol || "operador", bodega: registro.bodega || "M501" });
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
      if (!datosValidos(usuario, claveActual) || claveNueva.length > MAX_LARGO_CLAVE) {
        registrarFallo(llave);
        throw errorHttp(401, "Usuario o contraseña actual incorrectos.");
      }
      const llaveUsuario = `usuario:${usuario}`;
      if (bloqueado(llave) || bloqueado(llaveUsuario, MAX_INTENTOS_USUARIO)) throw errorHttp(429, "Demasiados intentos. Espera unos minutos.");
      const registro = await buscarUsuario(usuario);
      const correcta = registro ? await claveValida(claveActual, registro.clave_hash) : await hashClave(claveActual).then(() => false);
      if (!correcta) {
        registrarFallo(llave);
        registrarFallo(llaveUsuario);
        throw errorHttp(401, "Usuario o contraseña actual incorrectos.");
      }
      validarClaveNueva(claveNueva);
      if (claveNueva === claveActual) throw errorHttp(400, "La contraseña nueva debe ser distinta de la actual.");
      intentos.delete(llave);
      intentos.delete(llaveUsuario);
      await guardarUsuario(usuario, claveNueva);
      await registrarCambioUsuario(usuario, { objetivo: usuario, accion: "cambiar_clave" });
      const actualizado = await buscarUsuario(usuario);
      ponerCookie(req, res, crearToken(actualizado), DURACION_MS);
      res.json({ ok: true, usuario });
    } catch (error) {
      responderError(res, error, "No se pudo cambiar la contraseña.");
    }
  });

  app.post("/api/logout", async (req, res) => {
    try {
      const sesion = await sesionDe(req);
      if (sesion) {
        const { error } = await supabase.from("usuarios").update({ sesion_version: contadorDe(sesion.registro) + 1 }).eq("usuario", sesion.registro.usuario);
        if (error) console.error(error);
        cacheUsuarios.delete(sesion.registro.usuario);
      }
    } catch (error) {
      console.error(error);
    }
    ponerCookie(req, res, "", 0);
    res.json({ ok: true });
  });

  app.get("/api/sesion", async (req, res) => {
    try {
      const sesion = await sesionDe(req);
      if (!sesion) throw errorHttp(401, "Sesión no iniciada.");
      if (req.headers["x-actividad"] === "1" && sesion.registro.rol !== "desactivado") {
        const restante = Math.max(0, sesion.datos.ini + DURACION_MS - Date.now());
        ponerCookie(req, res, crearToken(sesion.registro, sesion.datos.ini), restante);
      }
      res.json({ usuario: sesion.registro.usuario, rol: sesion.registro.rol || "operador", bodega: sesion.registro.bodega || "M501" });
    } catch (error) {
      responderError(res, error, "No se pudo verificar la sesión.");
    }
  });
}

module.exports = {
  protegerApi,
  rutasAuth,
  guardarUsuario,
  contarUsuarios,
  exigirAdmin,
  exigirAdminM501,
  exigirAdminVer,
  exigirAdminM501oExt,
  buscarUsuario,
  hashClave,
  validarClaveNueva,
  registrarCambioUsuario,
  errorHttp,
  falloBd,
  responderError,
  cacheUsuarios,
};
