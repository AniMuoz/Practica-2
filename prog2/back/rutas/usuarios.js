const { supabase } = require("../supabase");
const { exigirAdmin, hashClave, validarClaveNueva, errorHttp, falloBd, responderError, cacheUsuarios } = require("../auth");

// Los contadores de intentos y la cache de usuarios viven en memoria: asumen una sola instancia del servidor.
// Cada alta, cambio de rol o de clave debe llamar a cacheUsuarios.delete para que surta efecto al instante.
const ROLES = new Set(["admin", "operador", "desactivado"]);
// Usuario protegido: ningun otro usuario puede modificarlo ni eliminarlo.
const USUARIO_PROTEGIDO = "adminm501";

function normalizar(valor) {
  return String(valor || "").trim().toLowerCase();
}

async function leerUsuario(nombre) {
  const { data, error } = await supabase.from("usuarios").select("usuario, rol").eq("usuario", nombre).maybeSingle();
  if (error) falloBd(error);
  return data;
}

const LIMITE_LOG = 50;

async function registrarCambio(actor, evento) {
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

async function listarCambios(filtros = {}) {
  const pagina = Math.max(1, Number.parseInt(filtros.pagina, 10) || 1);
  let q = supabase
    .from("usuarios_log")
    .select("id, creado_en, actor, objetivo, accion, rol_anterior, rol_nuevo", { count: "exact" });
  if (filtros.actor) q = q.eq("actor", String(filtros.actor));
  if (filtros.objetivo) q = q.eq("objetivo", String(filtros.objetivo));
  if (filtros.accion) q = q.eq("accion", String(filtros.accion));
  if (filtros.desde && typeof q.gte === "function") q = q.gte("creado_en", `${filtros.desde}T00:00:00`);
  if (filtros.hasta && typeof q.lte === "function") q = q.lte("creado_en", `${filtros.hasta}T23:59:59.999`);
  const desde = (pagina - 1) * LIMITE_LOG;
  const { data, count, error } = await q.order("creado_en", { ascending: false }).range(desde, desde + LIMITE_LOG - 1);
  if (error) falloBd(error);
  return { eventos: data || [], total: count || 0, pagina, por_pagina: LIMITE_LOG };
}

module.exports = function rutasUsuarios(app) {
  app.get("/api/usuarios/auditoria", async (req, res) => {
    try {
      await exigirAdmin(req);
      res.json(await listarCambios(req.query || {}));
    } catch (error) {
      responderError(res, error, "No se pudo leer la auditoría de usuarios.");
    }
  });

  app.get("/api/usuarios", async (req, res) => {
    try {
      await exigirAdmin(req);
      const { data, error } = await supabase.from("usuarios").select("usuario, rol, creado_en").order("usuario", { ascending: true });
      if (error) falloBd(error);
      res.json({ usuarios: data || [] });
    } catch (error) {
      responderError(res, error, "No se pudo listar el personal.");
    }
  });

  app.post("/api/usuarios", async (req, res) => {
    try {
      await exigirAdmin(req);
      const usuario = normalizar(req.body && req.body.usuario);
      const clave = req.body && req.body.clave;
      const rol = (req.body && req.body.rol) || "operador";
      if (!usuario) throw errorHttp(400, "Falta el nombre de usuario.");
      if (!ROLES.has(rol)) throw errorHttp(400, "El rol debe ser admin u operador.");
      validarClaveNueva(clave);
      if (await leerUsuario(usuario)) throw errorHttp(409, "Ese usuario ya existe.");
      const { error } = await supabase.from("usuarios").insert({ usuario, clave_hash: await hashClave(clave), rol });
      if (error) {
        if (error.code === "23505") throw errorHttp(409, "Ese usuario ya existe.");
        falloBd(error);
      }
      cacheUsuarios.delete(usuario);
      await registrarCambio(req.usuario, { objetivo: usuario, accion: "crear_usuario", rol_nuevo: rol });
      res.status(201).json({ usuario, rol });
    } catch (error) {
      responderError(res, error, "No se pudo crear el usuario.");
    }
  });

  app.post("/api/usuarios/:nombre/rol", async (req, res) => {
    try {
      await exigirAdmin(req);
      const usuario = normalizar(req.params.nombre);
      const rol = req.body && req.body.rol;
      if (usuario === USUARIO_PROTEGIDO) throw errorHttp(403, "Este usuario no se puede modificar.");
      if (usuario === req.usuario) throw errorHttp(400, "No puedes cambiar tu propio rol.");
      if (!ROLES.has(rol)) throw errorHttp(400, "Rol no válido.");
      const objetivo = await leerUsuario(usuario);
      if (!objetivo) throw errorHttp(404, "El usuario no existe.");
      const { error } = await supabase.from("usuarios").update({ rol }).eq("usuario", usuario);
      if (error) falloBd(error);
      cacheUsuarios.delete(usuario);
      await registrarCambio(req.usuario, { objetivo: usuario, accion: "cambiar_rol", rol_anterior: objetivo.rol, rol_nuevo: rol });
      res.json({ ok: true, usuario, rol });
    } catch (error) {
      responderError(res, error, "No se pudo cambiar el rol.");
    }
  });

  app.post("/api/usuarios/:nombre/clave", async (req, res) => {
    try {
      await exigirAdmin(req);
      const usuario = normalizar(req.params.nombre);
      if (usuario === USUARIO_PROTEGIDO && usuario !== req.usuario) throw errorHttp(403, "Este usuario no se puede modificar.");
      if (usuario === req.usuario) throw errorHttp(400, "Tu propia contraseña se cambia desde «Cambiar contraseña».");
      validarClaveNueva(req.body && req.body.clave);
      if (!(await leerUsuario(usuario))) throw errorHttp(404, "El usuario no existe.");
      const { error } = await supabase.from("usuarios").update({ clave_hash: await hashClave(req.body.clave) }).eq("usuario", usuario);
      if (error) falloBd(error);
      cacheUsuarios.delete(usuario);
      await registrarCambio(req.usuario, { objetivo: usuario, accion: "cambiar_clave" });
      res.json({ ok: true, usuario });
    } catch (error) {
      responderError(res, error, "No se pudo cambiar la contraseña.");
    }
  });

  app.delete("/api/usuarios/:nombre", async (req, res) => {
    try {
      await exigirAdmin(req);
      const usuario = normalizar(req.params.nombre);
      if (usuario === USUARIO_PROTEGIDO) throw errorHttp(403, "Este usuario no se puede eliminar.");
      const objetivo = await leerUsuario(usuario);
      if (!objetivo) throw errorHttp(404, "El usuario no existe.");
      if (usuario === req.usuario) throw errorHttp(400, "No puedes eliminarte a ti mismo.");
      if (objetivo.rol === "admin") {
        const { count, error } = await supabase.from("usuarios").select("usuario", { count: "exact", head: true }).eq("rol", "admin");
        if (error) falloBd(error);
        if ((count || 0) <= 1) throw errorHttp(400, "No se puede eliminar al único administrador.");
      }
      const { error } = await supabase.from("usuarios").delete().eq("usuario", usuario);
      if (error) falloBd(error);
      cacheUsuarios.delete(usuario);
      await registrarCambio(req.usuario, { objetivo: usuario, accion: "eliminar_usuario", rol_anterior: objetivo.rol });
      res.json({ ok: true, usuario });
    } catch (error) {
      responderError(res, error, "No se pudo eliminar el usuario.");
    }
  });
};
