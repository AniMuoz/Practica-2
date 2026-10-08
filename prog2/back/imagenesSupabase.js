const { supabase } = require("./supabase");

const CUBO = "imagenes";

function fallo(error) {
  const propio = new Error(error.message || "No se pudo guardar la imagen.");
  propio.status = 502;
  throw propio;
}

async function asegurarCubo() {
  const { error } = await supabase.storage.createBucket(CUBO, { public: true });
  if (!error) return;
  if (/already exists|duplicate/i.test(error.message)) return;
  fallo(error);
}

async function subirImagen(nombre, buffer, tipo) {
  await asegurarCubo();
  const { error } = await supabase.storage.from(CUBO).upload(nombre, buffer, {
    upsert: true,
    contentType: tipo || "application/octet-stream",
  });
  if (error) fallo(error);
}

async function bajarImagen(nombre) {
  const { data, error } = await supabase.storage.from(CUBO).download(nombre);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function quitarImagen(nombre) {
  if (!nombre) return;
  const { error } = await supabase.storage.from(CUBO).remove([nombre]);
  if (error && !/not found/i.test(error.message)) fallo(error);
}

module.exports = { subirImagen, bajarImagen, quitarImagen, asegurarCubo };
