process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";
process.env.SESSION_SECRET = "secreto-de-prueba";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const express = require("express");
const { supabase } = require("../supabase");
const { protegerApi, rutasAuth, guardarUsuario, contarUsuarios } = require("../auth");

// Los rechazos esperados imprimen su traza con console.error; se silencian aquí.
test.mock.method(console, "error", () => {});

// Base de datos falsa: reemplaza supabase.from("usuarios") con un Map en memoria.
const usuarios = new Map();
let errorBd = null;

const roles = new Map();

supabase.from = (tabla) => {
  assert.equal(tabla, "usuarios");
  const e = { op: "select", filtros: [], valores: null, head: false, unico: false, orden: false };
  const fila = (nombre) => ({ usuario: nombre, clave_hash: usuarios.get(nombre), rol: roles.get(nombre) || "operador", creado_en: "2026-01-01T00:00:00Z" });
  const b = {
    select(columnas, opciones) { e.cols = String(columnas).split(",").map((c) => c.trim()); if (opciones && opciones.head) e.head = true; return b; },
    insert(valores) { e.op = "insert"; e.valores = valores; return b; },
    update(valores) { e.op = "update"; e.valores = valores; return b; },
    delete() { e.op = "delete"; return b; },
    upsert(valores) { e.op = "upsert"; e.valores = valores; return b; },
    eq(campo, valor) { e.filtros.push([campo, valor]); return b; },
    order() { e.orden = true; return b; },
    maybeSingle() { e.unico = true; return b; },
    then(resolver, rechazar) { return Promise.resolve(ejecutar()).then(resolver, rechazar); },
  };
  function ejecutar() {
    if (errorBd) return { data: null, count: null, error: errorBd };
    const coincide = (n) => e.filtros.every(([campo, valor]) => fila(n)[campo] === valor);
    if (e.op === "insert" || e.op === "upsert") {
      const v = e.valores;
      if (e.op === "insert" && usuarios.has(v.usuario)) return { error: { code: "23505", message: "duplicado" } };
      usuarios.set(v.usuario, v.clave_hash);
      if (v.rol) roles.set(v.usuario, v.rol);
      return { error: null };
    }
    if (e.op === "update") {
      for (const n of [...usuarios.keys()].filter(coincide)) if (e.valores.clave_hash) usuarios.set(n, e.valores.clave_hash);
      return { error: null };
    }
    if (e.op === "delete") {
      for (const n of [...usuarios.keys()].filter(coincide)) { usuarios.delete(n); roles.delete(n); }
      return { error: null };
    }
    const nombres = [...usuarios.keys()].filter(coincide).sort();
    if (e.head) return { count: nombres.length, error: null };
    const recorte = (n) => Object.fromEntries(e.cols.map((c) => [c, fila(n)[c]]));
    if (e.unico) return { data: nombres.length ? recorte(nombres[0]) : null, error: null };
    return { data: nombres.map(recorte), error: null };
  }
  return b;
};
const app = express();
app.use(express.json());
app.use("/api", protegerApi);
rutasAuth(app);
require("../rutas/usuarios")(app);
app.get("/api/privado", (req, res) => res.json({ usuario: req.usuario }));

let contadorClientes = 0;
function clienteNuevo() {
  contadorClientes += 1;
  return `10.0.0.${contadorClientes}`;
}

let servidor;
let base;
test.before(async () => {
  await new Promise((resolve) => {
    servidor = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
});
test.after(() => servidor.close());

async function pedir(metodo, ruta, { cuerpo, cookie, cliente, cabeceras } = {}) {
  const respuesta = await fetch(base + ruta, {
    method: metodo,
    headers: {
      ...(cuerpo ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      "x-forwarded-for": cliente || clienteNuevo(),
      ...cabeceras,
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const cookies = respuesta.headers.getSetCookie();
  return {
    status: respuesta.status,
    json: await respuesta.json().catch(() => null),
    cookies,
    cookie: cookies.length ? cookies[cookies.length - 1].split(";")[0] : "",
  };
}

function tokenManual({ u, v, exp }) {
  const cuerpo = Buffer.from(JSON.stringify({ u, v, exp })).toString("base64url");
  const firma = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(cuerpo).digest("base64url");
  return `${cuerpo}.${firma}`;
}

const DIA = 24 * 60 * 60 * 1000;

test("guardarUsuario normaliza el nombre, guarda un hash y no la clave", async () => {
  const nombre = await guardarUsuario("  Ana ", "clave-segura-1");
  assert.equal(nombre, "ana");
  const guardado = usuarios.get("ana");
  assert.ok(guardado.includes(":"));
  assert.equal(guardado.includes("clave-segura-1"), false);
});

test("guardarUsuario usa una sal distinta cada vez", async () => {
  await guardarUsuario("sal1", "misma-clave-1");
  await guardarUsuario("sal2", "misma-clave-1");
  assert.notEqual(usuarios.get("sal1"), usuarios.get("sal2"));
});

test("guardarUsuario rechaza claves de menos de 8 caracteres", async () => {
  await assert.rejects(guardarUsuario("corto", "1234567"), { status: 400 });
  await assert.rejects(guardarUsuario("corto", ""), { status: 400 });
  await assert.rejects(guardarUsuario("corto", undefined), { status: 400 });
  assert.equal(usuarios.has("corto"), false);
});

test("contarUsuarios devuelve la cantidad registrada", async () => {
  await guardarUsuario("contado", "clave-segura-1");
  assert.equal(await contarUsuarios(), usuarios.size);
});

test("un fallo de Supabase se traduce a 503 si falta la tabla y a 502 en otro caso", async () => {
  errorBd = { code: "PGRST205", message: "no existe" };
  await assert.rejects(contarUsuarios(), { status: 503 });
  errorBd = { code: "XX", message: "red caída" };
  await assert.rejects(contarUsuarios(), { status: 502, message: "red caída" });
  const respuesta = await pedir("POST", "/api/login", { cuerpo: { usuario: "sin-cache-bd", clave: "x" } });
  assert.equal(respuesta.status, 502);
  errorBd = null;
});

test("login correcto responde el usuario y entrega una cookie HttpOnly", async () => {
  await guardarUsuario("luis", "clave-segura-1");
  const respuesta = await pedir("POST", "/api/login", { cuerpo: { usuario: " LUIS ", clave: "clave-segura-1" } });
  assert.equal(respuesta.status, 200);
  assert.deepEqual(respuesta.json, { usuario: "luis", rol: "operador" });
  const cookie = respuesta.cookies[0];
  assert.match(cookie, /^sesion=[^;]+/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, new RegExp(`Max-Age=${7 * 24 * 60 * 60}`));
  assert.doesNotMatch(cookie, /Secure/);
});

test("la cookie lleva Secure cuando la petición llegó por https", async () => {
  await guardarUsuario("segura", "clave-segura-1");
  const respuesta = await pedir("POST", "/api/login", {
    cuerpo: { usuario: "segura", clave: "clave-segura-1" },
    cabeceras: { "x-forwarded-proto": "https" },
  });
  assert.match(respuesta.cookies[0], /Secure/);
});

test("login con clave incorrecta o usuario inexistente da el mismo 401", async () => {
  await guardarUsuario("pedro", "clave-segura-1");
  const mala = await pedir("POST", "/api/login", { cuerpo: { usuario: "pedro", clave: "otra-clave-1" } });
  const inexistente = await pedir("POST", "/api/login", { cuerpo: { usuario: "nadie", clave: "otra-clave-1" } });
  assert.equal(mala.status, 401);
  assert.equal(inexistente.status, 401);
  assert.equal(mala.json.error, inexistente.json.error);
  assert.equal(mala.cookies.length, 0);
});

test("login sin cuerpo no rompe y responde 401", async () => {
  const respuesta = await pedir("POST", "/api/login");
  assert.equal(respuesta.status, 401);
});

test("tras 10 fallos el cliente queda bloqueado aunque use la clave correcta", async () => {
  await guardarUsuario("bloqueo", "clave-segura-1");
  const cliente = clienteNuevo();
  for (let i = 0; i < 10; i += 1) {
    const fallo = await pedir("POST", "/api/login", { cuerpo: { usuario: "bloqueo", clave: "mala" }, cliente });
    assert.equal(fallo.status, 401);
  }
  const bloqueado = await pedir("POST", "/api/login", { cuerpo: { usuario: "bloqueo", clave: "clave-segura-1" }, cliente });
  assert.equal(bloqueado.status, 429);
  assert.equal(bloqueado.cookies.length, 0);
  const otroCliente = await pedir("POST", "/api/login", { cuerpo: { usuario: "bloqueo", clave: "clave-segura-1" } });
  assert.equal(otroCliente.status, 200);
});

test("un login correcto reinicia el contador de fallos", async () => {
  await guardarUsuario("reinicio", "clave-segura-1");
  const cliente = clienteNuevo();
  const mal = () => pedir("POST", "/api/login", { cuerpo: { usuario: "reinicio", clave: "mala" }, cliente });
  for (let i = 0; i < 9; i += 1) await mal();
  const bien = await pedir("POST", "/api/login", { cuerpo: { usuario: "reinicio", clave: "clave-segura-1" }, cliente });
  assert.equal(bien.status, 200);
  for (let i = 0; i < 9; i += 1) assert.equal((await mal()).status, 401);
});

test("las rutas privadas exigen sesión", async () => {
  const sinCookie = await pedir("GET", "/api/privado");
  assert.equal(sinCookie.status, 401);
  const basura = await pedir("GET", "/api/privado", { cookie: "sesion=abc.def" });
  assert.equal(basura.status, 401);
});

test("con una sesión válida la ruta privada conoce al usuario y no renueva la cookie", async () => {
  await guardarUsuario("marta", "clave-segura-1");
  const login = await pedir("POST", "/api/login", { cuerpo: { usuario: "marta", clave: "clave-segura-1" } });
  const respuesta = await pedir("GET", "/api/privado", { cookie: login.cookie });
  assert.equal(respuesta.status, 200);
  assert.deepEqual(respuesta.json, { usuario: "marta" });
  assert.equal(respuesta.cookies.length, 0);
});

test("un token alterado o firmado con otro secreto se rechaza", async () => {
  await guardarUsuario("alterado", "clave-segura-1");
  const login = await pedir("POST", "/api/login", { cuerpo: { usuario: "alterado", clave: "clave-segura-1" } });
  const [cuerpo, firma] = login.cookie.replace("sesion=", "").split(".");
  const otroCuerpo = Buffer.from(JSON.stringify({ u: "admin", v: "x", exp: Date.now() + DIA })).toString("base64url");
  const cambiado = await pedir("GET", "/api/privado", { cookie: `sesion=${otroCuerpo}.${firma}` });
  assert.equal(cambiado.status, 401);
  const ajeno = crypto.createHmac("sha256", "otro-secreto").update(cuerpo).digest("base64url");
  const conOtraFirma = await pedir("GET", "/api/privado", { cookie: `sesion=${cuerpo}.${ajeno}` });
  assert.equal(conOtraFirma.status, 401);
});

test("un token vencido se rechaza", async () => {
  await guardarUsuario("vencido", "clave-segura-1");
  const version = usuarios.get("vencido").split(":")[0];
  const vigente = tokenManual({ u: "vencido", v: version, exp: Date.now() + DIA });
  const vencido = tokenManual({ u: "vencido", v: version, exp: Date.now() - 1000 });
  assert.equal((await pedir("GET", "/api/privado", { cookie: `sesion=${vigente}` })).status, 200);
  assert.equal((await pedir("GET", "/api/privado", { cookie: `sesion=${vencido}` })).status, 401);
});

test("un token con datos inválidos se rechaza aunque esté bien firmado", async () => {
  const sinUsuario = tokenManual({ u: 5, v: "x", exp: Date.now() + DIA });
  const sinExp = tokenManual({ u: "ana", v: "x", exp: "mañana" });
  assert.equal((await pedir("GET", "/api/privado", { cookie: `sesion=${sinUsuario}` })).status, 401);
  assert.equal((await pedir("GET", "/api/privado", { cookie: `sesion=${sinExp}` })).status, 401);
});

test("un token de un usuario que ya no existe se rechaza", async () => {
  const token = tokenManual({ u: "fantasma", v: "x", exp: Date.now() + DIA });
  assert.equal((await pedir("GET", "/api/privado", { cookie: `sesion=${token}` })).status, 401);
});

test("una sesión con poco tiempo restante se renueva", async () => {
  await guardarUsuario("renueva", "clave-segura-1");
  const version = usuarios.get("renueva").split(":")[0];
  const token = tokenManual({ u: "renueva", v: version, exp: Date.now() + DIA });
  const respuesta = await pedir("GET", "/api/privado", { cookie: `sesion=${token}` });
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.cookies.length, 1);
  assert.notEqual(respuesta.cookie, `sesion=${token}`);
  assert.equal((await pedir("GET", "/api/privado", { cookie: respuesta.cookie })).status, 200);
});

test("las rutas públicas no piden sesión", async () => {
  assert.equal((await pedir("POST", "/api/logout")).status, 200);
  assert.equal((await pedir("POST", "/api/login", { cuerpo: { usuario: "x", clave: "y" } })).status, 401);
});

test("/api/sesion informa el usuario o responde 401", async () => {
  await guardarUsuario("sesionada", "clave-segura-1");
  const login = await pedir("POST", "/api/login", { cuerpo: { usuario: "sesionada", clave: "clave-segura-1" } });
  const con = await pedir("GET", "/api/sesion", { cookie: login.cookie });
  assert.deepEqual(con.json, { usuario: "sesionada", rol: "operador" });
  assert.equal((await pedir("GET", "/api/sesion")).status, 401);
});

test("logout borra la cookie", async () => {
  const respuesta = await pedir("POST", "/api/logout");
  assert.deepEqual(respuesta.json, { ok: true });
  assert.match(respuesta.cookies[0], /^sesion=;/);
  assert.match(respuesta.cookies[0], /Max-Age=0/);
});

test("la cookie se lee aunque haya otras cookies y valores codificados", async () => {
  await guardarUsuario("galleta", "clave-segura-1");
  const login = await pedir("POST", "/api/login", { cuerpo: { usuario: "galleta", clave: "clave-segura-1" } });
  const respuesta = await pedir("GET", "/api/privado", { cookie: `otra=1; ${login.cookie}; ultima=2` });
  assert.equal(respuesta.status, 200);
});

test("cambiar la clave valida la actual, el largo y que sea distinta", async () => {
  await guardarUsuario("cambia", "clave-vieja-1");
  const cambiar = (cuerpo) => pedir("POST", "/api/cambiar-clave", { cuerpo: { usuario: "cambia", ...cuerpo } });
  assert.equal((await cambiar({ claveActual: "incorrecta", claveNueva: "clave-nueva-1" })).status, 401);
  assert.equal((await cambiar({ claveActual: "clave-vieja-1", claveNueva: "corta" })).status, 400);
  assert.equal((await cambiar({ claveActual: "clave-vieja-1", claveNueva: "clave-vieja-1" })).status, 400);
  assert.equal((await pedir("POST", "/api/cambiar-clave", { cuerpo: { usuario: "nadie", claveActual: "a", claveNueva: "clave-nueva-1" } })).status, 401);
  const login = await pedir("POST", "/api/login", { cuerpo: { usuario: "cambia", clave: "clave-vieja-1" } });
  assert.equal(login.status, 200);
});

test("cambiar la clave invalida las sesiones antiguas y abre una nueva", async () => {
  await guardarUsuario("rota", "clave-vieja-1");
  const antes = await pedir("POST", "/api/login", { cuerpo: { usuario: "rota", clave: "clave-vieja-1" } });
  assert.equal((await pedir("GET", "/api/privado", { cookie: antes.cookie })).status, 200);

  const cambio = await pedir("POST", "/api/cambiar-clave", {
    cuerpo: { usuario: "rota", claveActual: "clave-vieja-1", claveNueva: "clave-nueva-1" },
  });
  assert.equal(cambio.status, 200);
  assert.deepEqual(cambio.json, { ok: true, usuario: "rota" });

  assert.equal((await pedir("GET", "/api/privado", { cookie: antes.cookie })).status, 401);
  assert.equal((await pedir("GET", "/api/privado", { cookie: cambio.cookie })).status, 200);
  assert.equal((await pedir("POST", "/api/login", { cuerpo: { usuario: "rota", clave: "clave-vieja-1" } })).status, 401);
  assert.equal((await pedir("POST", "/api/login", { cuerpo: { usuario: "rota", clave: "clave-nueva-1" } })).status, 200);
});

test("cambiar la clave también se bloquea tras demasiados fallos", async () => {
  await guardarUsuario("cambiobloq", "clave-vieja-1");
  const cliente = clienteNuevo();
  const intento = (claveActual) => pedir("POST", "/api/cambiar-clave", {
    cuerpo: { usuario: "cambiobloq", claveActual, claveNueva: "clave-nueva-1" },
    cliente,
  });
  for (let i = 0; i < 10; i += 1) assert.equal((await intento("mala")).status, 401);
  assert.equal((await intento("clave-vieja-1")).status, 429);
});


// ---------- gestión de personal ----------

async function entrar(usuario, clave) {
  const r = await pedir("POST", "/api/login", { cuerpo: { usuario, clave } });
  assert.equal(r.status, 200);
  return r.cookie;
}

async function sesionAdmin(nombre = "jefe") {
  await guardarUsuario(nombre, "clave-admin-1", "admin");
  return entrar(nombre, "clave-admin-1");
}

test("login y /api/sesion incluyen el rol", async () => {
  await guardarUsuario("rolado", "clave-segura-1", "admin");
  const login = await pedir("POST", "/api/login", { cuerpo: { usuario: "rolado", clave: "clave-segura-1" } });
  assert.equal(login.json.rol, "admin");
  assert.equal((await pedir("GET", "/api/sesion", { cookie: login.cookie })).json.rol, "admin");
});

test("un operador recibe 403 en todas las rutas de personal", async () => {
  await guardarUsuario("oper", "clave-segura-1");
  const cookie = await entrar("oper", "clave-segura-1");
  assert.equal((await pedir("GET", "/api/usuarios", { cookie })).status, 403);
  assert.equal((await pedir("POST", "/api/usuarios", { cookie, cuerpo: { usuario: "x", clave: "clave-segura-1" } })).status, 403);
  assert.equal((await pedir("DELETE", "/api/usuarios/oper", { cookie })).status, 403);
  assert.equal((await pedir("POST", "/api/usuarios/oper/clave", { cookie, cuerpo: { clave: "clave-segura-2" } })).status, 403);
  assert.equal((await pedir("GET", "/api/usuarios")).status, 401);
});

test("el admin crea un operador y aparece en el listado sin clave_hash", async () => {
  const cookie = await sesionAdmin("jefe1");
  const creado = await pedir("POST", "/api/usuarios", { cookie, cuerpo: { usuario: "  Nuevo1 ", clave: "clave-segura-1" } });
  assert.equal(creado.status, 201);
  assert.deepEqual(creado.json, { usuario: "nuevo1", rol: "operador" });
  const lista = await pedir("GET", "/api/usuarios", { cookie });
  const fila = lista.json.usuarios.find((u) => u.usuario === "nuevo1");
  assert.equal(fila.rol, "operador");
  assert.ok(lista.json.usuarios.every((u) => !("clave_hash" in u)));
  await entrar("nuevo1", "clave-segura-1");
});

test("crear con un nombre repetido da 409 y no pisa la clave", async () => {
  const cookie = await sesionAdmin("jefe2");
  await guardarUsuario("repetido", "clave-original-1");
  const r = await pedir("POST", "/api/usuarios", { cookie, cuerpo: { usuario: "repetido", clave: "clave-otra-123" } });
  assert.equal(r.status, 409);
  await entrar("repetido", "clave-original-1");
});

test("crear valida nombre, rol y largo de la clave", async () => {
  const cookie = await sesionAdmin("jefe3");
  assert.equal((await pedir("POST", "/api/usuarios", { cookie, cuerpo: { usuario: "  ", clave: "clave-segura-1" } })).status, 400);
  assert.equal((await pedir("POST", "/api/usuarios", { cookie, cuerpo: { usuario: "corta1", clave: "1234567" } })).status, 400);
  assert.equal((await pedir("POST", "/api/usuarios", { cookie, cuerpo: { usuario: "rolmalo", clave: "clave-segura-1", rol: "dios" } })).status, 400);
  assert.equal(usuarios.has("corta1"), false);
});

test("el admin no puede borrarse y no se borra al último admin", async () => {
  const cookie = await sesionAdmin("unico");
  for (const [nombre] of [...usuarios]) if (nombre !== "unico" && roles.get(nombre) === "admin") roles.delete(nombre);
  assert.equal((await pedir("DELETE", "/api/usuarios/unico", { cookie })).status, 400);
  assert.equal((await pedir("DELETE", "/api/usuarios/fantasma", { cookie })).status, 404);
  // otro admin para poder intentar borrar al "último": se degrada al primero.
  await guardarUsuario("segundo", "clave-admin-1", "admin");
  const cookie2 = await entrar("segundo", "clave-admin-1");
  roles.set("unico", "operador");
  roles.set("segundo", "admin");
  roles.set("unico", "admin");
  const r = await pedir("DELETE", "/api/usuarios/unico", { cookie: cookie2 });
  assert.equal(r.status, 200);
  // ahora "segundo" es el único admin y otro admin ficticio no existe: crear uno y quitar al resto.
  for (const n of [...roles.keys()]) if (n !== "segundo") roles.delete(n);
  usuarios.set("tercero", usuarios.get("segundo"));
  roles.set("tercero", "operador");
  assert.equal((await pedir("DELETE", "/api/usuarios/segundo", { cookie: cookie2 })).status, 400);
});

test("el admin borra a otro y su login y cookie dejan de valer", async () => {
  const cookie = await sesionAdmin("jefe4");
  await guardarUsuario("victima", "clave-segura-1");
  const cookieVictima = await entrar("victima", "clave-segura-1");
  const r = await pedir("DELETE", "/api/usuarios/victima", { cookie });
  assert.equal(r.status, 200);
  assert.equal((await pedir("POST", "/api/login", { cuerpo: { usuario: "victima", clave: "clave-segura-1" } })).status, 401);
  assert.equal((await pedir("GET", "/api/privado", { cookie: cookieVictima })).status, 401);
});

test("el admin resetea la clave de otro y la cookie anterior queda inválida", async () => {
  const cookie = await sesionAdmin("jefe5");
  await guardarUsuario("olvidadizo", "clave-vieja-1");
  const cookieVieja = await entrar("olvidadizo", "clave-vieja-1");
  assert.equal((await pedir("POST", "/api/usuarios/olvidadizo/clave", { cookie, cuerpo: { clave: "corta" } })).status, 400);
  assert.equal((await pedir("POST", "/api/usuarios/nadie/clave", { cookie, cuerpo: { clave: "clave-nueva-1" } })).status, 404);
  assert.equal((await pedir("POST", "/api/usuarios/jefe5/clave", { cookie, cuerpo: { clave: "clave-nueva-1" } })).status, 400);
  const r = await pedir("POST", "/api/usuarios/olvidadizo/clave", { cookie, cuerpo: { clave: "clave-nueva-1" } });
  assert.deepEqual(r.json, { ok: true, usuario: "olvidadizo" });
  assert.equal((await pedir("POST", "/api/login", { cuerpo: { usuario: "olvidadizo", clave: "clave-vieja-1" } })).status, 401);
  await entrar("olvidadizo", "clave-nueva-1");
  assert.equal((await pedir("GET", "/api/privado", { cookie: cookieVieja })).status, 401);
});