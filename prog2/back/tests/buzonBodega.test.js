process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "secreto-de-prueba";

const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { supabase } = require("../supabase/supabase");
const { contextoBodega } = require("../servicios/nucleoDatos");
const auth = require("../seguridad/auth");

delete process.env.SECRETO_PROXY;
test.mock.method(console, "error", () => {});

// Mensajes en memoria indexados por id.
let mensajes = [];
let siguienteId = 1;
let eventos = [];

const compartido = require("../utils/compartido");
compartido.emitir = (evento) => eventos.push(evento);

auth.exigirAdmin = async (req) => {
  if (req.rol !== "admin") {
    const error = new Error("Solo un administrador puede hacer esto.");
    error.status = 403;
    throw error;
  }
};
auth.buscarUsuario = async (nombre) => {
  if (nombre === "jefe") return { usuario: "jefe", rol: "admin", bodega: "M501" };
  if (nombre === "op502") return { usuario: "op502", rol: "operador", bodega: "M502" };
  if (nombre === "op501") return { usuario: "op501", rol: "operador", bodega: "M501" };
  return null;
};

supabase.from = (tabla) => {
  assert.equal(tabla, "buzon");
  const e = { op: "select", filtros: {}, valores: null, head: false, unico: false, count: false };
  const b = {
    select(_cols, opciones) {
      if (opciones && opciones.count === "exact") e.count = true;
      if (opciones && opciones.head) e.head = true;
      return b;
    },
    insert(valores) {
      e.op = "insert";
      e.valores = valores;
      return b;
    },
    update(valores) {
      e.op = "update";
      e.valores = valores;
      return b;
    },
    delete() {
      e.op = "delete";
      return b;
    },
    eq(campo, valor) {
      e.filtros[campo] = valor;
      return b;
    },
    order() {
      return b;
    },
    maybeSingle() {
      e.unico = true;
      return b;
    },
    single() {
      e.unico = true;
      return b;
    },
    then(resolver, rechazar) {
      return Promise.resolve(ejecutar()).then(resolver, rechazar);
    },
  };

  function filtrar() {
    return mensajes.filter((m) => Object.entries(e.filtros).every(([k, v]) => String(m[k]) === String(v)));
  }

  function ejecutar() {
    if (e.op === "insert") {
      const fila = { id: siguienteId++, creado_en: "2026-01-01T00:00:00Z", estado: "sin revisar", ...e.valores };
      mensajes.push(fila);
      return { data: e.unico ? fila : [fila], error: null };
    }
    if (e.op === "update") {
      const filas = filtrar();
      for (const f of filas) Object.assign(f, e.valores);
      if (e.unico) return { data: filas[0] || null, error: null };
      return { data: filas, error: null };
    }
    if (e.op === "delete") {
      const ids = new Set(filtrar().map((m) => m.id));
      mensajes = mensajes.filter((m) => !ids.has(m.id));
      return { error: null };
    }
    const filas = filtrar();
    if (e.head || e.count) return { count: filas.length, data: null, error: null };
    if (e.unico) return { data: filas[0] || null, error: null };
    return { data: filas, error: null };
  }

  return b;
};

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const bodega = String(req.get("X-Bodega") || "M501").toUpperCase();
  contextoBodega.run({ bodega }, () => {
    req.usuario = req.get("X-Usuario") || "jefe";
    req.rol = req.get("X-Rol") || "admin";
    req.bodega = req.get("X-Bodega-Usuario") || bodega;
    next();
  });
});
require("../rutas/buzon")(app);

let servidor;
let base;
test.before(async () => {
  await new Promise((resolve) => {
    servidor = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
});
test.after(() => servidor.close());
test.beforeEach(() => {
  mensajes = [];
  siguienteId = 1;
  eventos = [];
});

async function pedir(metodo, ruta, { cuerpo, bodega, usuario, rol } = {}) {
  const respuesta = await fetch(base + ruta, {
    method: metodo,
    headers: {
      ...(cuerpo ? { "Content-Type": "application/json" } : {}),
      ...(bodega ? { "X-Bodega": bodega } : {}),
      ...(usuario ? { "X-Usuario": usuario } : {}),
      ...(rol ? { "X-Rol": rol } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const data = await respuesta.json().catch(() => ({}));
  return { status: respuesta.status, data };
}

test("al crear un mensaje se guarda la bodega activa", async () => {
  const r = await pedir("POST", "/api/buzon", {
    usuario: "op502",
    rol: "operador",
    bodega: "M502",
    cuerpo: { titulo: "Falta stock", descripcion: "Sin pernos en San Juan", urgencia: "alta" },
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.mensaje.bodega, "M502");
  assert.equal(eventos[0].bodega, "M502");
});

test("el admin solo lista mensajes de la bodega activa", async () => {
  mensajes = [
    { id: 1, usuario: "op501", titulo: "A", descripcion: "a", urgencia: "leve", estado: "sin revisar", bodega: "M501", creado_en: "2026-01-01" },
    { id: 2, usuario: "op502", titulo: "B", descripcion: "b", urgencia: "media", estado: "sin revisar", bodega: "M502", creado_en: "2026-01-02" },
  ];
  siguienteId = 3;

  const m501 = await pedir("GET", "/api/buzon", { bodega: "M501" });
  assert.equal(m501.status, 200);
  assert.deepEqual(m501.data.mensajes.map((m) => m.id), [1]);

  const m502 = await pedir("GET", "/api/buzon", { bodega: "M502" });
  assert.equal(m502.status, 200);
  assert.deepEqual(m502.data.mensajes.map((m) => m.id), [2]);
});

test("los pendientes del admin cuentan solo la bodega activa", async () => {
  mensajes = [
    { id: 1, estado: "sin revisar", bodega: "M501" },
    { id: 2, estado: "sin revisar", bodega: "M502" },
    { id: 3, estado: "cerrado", bodega: "M501" },
  ];

  const r = await pedir("GET", "/api/buzon/pendientes", { bodega: "M501" });
  assert.equal(r.status, 200);
  assert.equal(r.data.pendientes, 1);
});

test("el admin no puede cambiar estado de un mensaje de otra bodega", async () => {
  mensajes = [
    { id: 9, usuario: "op502", titulo: "X", descripcion: "x", urgencia: "leve", estado: "sin revisar", bodega: "M502", creado_en: "2026-01-01" },
  ];
  const r = await pedir("PUT", "/api/buzon/9/estado", {
    bodega: "M501",
    cuerpo: { estado: "revisando" },
  });
  assert.equal(r.status, 404);
  assert.equal(mensajes[0].estado, "sin revisar");
});
