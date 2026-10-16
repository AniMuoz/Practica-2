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

supabase.from = (tabla) => {
  assert.equal(tabla, "usuarios");
  return {
    select(_columnas, opciones) {
      if (opciones && opciones.head) {
        return Promise.resolve(errorBd ? { count: null, error: errorBd } : { count: usuarios.size, error: null });
      }
      return {
        eq: (_campo, valor) => ({
          maybeSingle: async () => {
            if (errorBd) return { data: null, error: errorBd };
            return { data: usuarios.has(valor) ? { usuario: valor, clave_hash: usuarios.get(valor) } : null, error: null };
          },
        }),
      };
    },
    async upsert(fila) {
      if (errorBd) return { error: errorBd };
      usuarios.set(fila.usuario, fila.clave_hash);
      return { error: null };
    },
  };
};

const app = express();
app.use(express.json());
app.use("/api", protegerApi);
rutasAuth(app);
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
  assert.deepEqual(respuesta.json, { usuario: "luis" });
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
  assert.deepEqual(con.json, { usuario: "sesionada" });
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
