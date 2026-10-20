const { supabase } = require("../supabase");
const { exigirAdmin, hashClave, validarClaveNueva, errorHttp, falloBd, responderError, cacheUsuarios } = require("../auth");

// Los contadores de intentos y la cache de usuarios viven en memoria: asumen una sola instancia del servidor.
// Cada alta, cambio de rol o de clave debe llamar a cacheUsuarios.delete para que surta efecto al instante.
const ROLES = new Set(["admin", "operador"]);

function normalizar(valor) {
  return String(valor || "").trim().toLowerCase();
}

async function leerUsuario(nombre) {
  const { data, error } = await supabase.from("usuarios").select("usuario, rol").eq("usuario", nombre).maybeSingle();
  if (error) falloBd(error);
  return data;
}

module.exports = function rutasUsuarios(app) {
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
      res.status(201).json({ usuario, rol });
    } catch (error) {
      responderError(res, error, "No se pudo crear el usuario.");
    }
  });

  app.post("/api/usuarios/:nombre/clave", async (req, res) => {
    try {
      await exigirAdmin(req);
      const usuario = normalizar(req.params.nombre);
      if (usuario === req.usuario) throw errorHttp(400, "Tu propia contraseña se cambia desde «Cambiar contraseña».");
      validarClaveNueva(req.body && req.body.clave);
      if (!(await leerUsuario(usuario))) throw errorHttp(404, "El usuario no existe.");
      const { error } = await supabase.from("usuarios").update({ clave_hash: await hashClave(req.body.clave) }).eq("usuario", usuario);
      if (error) falloBd(error);
      cacheUsuarios.delete(usuario);
      res.json({ ok: true, usuario });
    } catch (error) {
      responderError(res, error, "No se pudo cambiar la contraseña.");
    }
  });

  app.delete("/api/usuarios/:nombre", async (req, res) => {
    try {
      await exigirAdmin(req);
      const usuario = normalizar(req.params.nombre);
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
      res.json({ ok: true, usuario });
    } catch (error) {
      responderError(res, error, "No se pudo eliminar el usuario.");
    }
  });
};
