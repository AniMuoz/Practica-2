const { supabase } = require("./supabase");

const CUBO = "imagenes";

function fallo(error) {
  const propio = new Error(error.message || "No se pudo guardar la imagen.");
  propio.status = 502;
  throw propio;
}

async function asegurarCubo(cliente = supabase) {
  const { error } = await cliente.storage.createBucket(CUBO, { public: true });
  if (!error) return;
  if (/already exists|duplicate/i.test(error.message)) return;
  fallo(error);
}

async function subirImagen(nombre, buffer, tipo, cliente = supabase) {
  await asegurarCubo(cliente);
  const { error } = await cliente.storage.from(CUBO).upload(nombre, buffer, {
    upsert: true,
    contentType: tipo || "application/octet-stream",
  });
  if (error) fallo(error);
}

async function bajarImagen(nombre, cliente = supabase) {
  const { data, error } = await cliente.storage.from(CUBO).download(nombre);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function quitarImagen(nombre, cliente = supabase) {
  if (!nombre) return;
  const { error } = await cliente.storage.from(CUBO).remove([nombre]);
  if (error && !/not found/i.test(error.message)) fallo(error);
}

module.exports = { subirImagen, bajarImagen, quitarImagen, asegurarCubo };
