const { supabase } = require("./supabase");

const CUBO = "imagenes";

function fallo(error) {
  console.error(error);
  const propio = new Error("No se pudo guardar la imagen.");
  propio.status = 502;
  throw propio;
}

async function asegurarCubo(cliente = supabase) {
  const { error } = await cliente.storage.createBucket(CUBO, { public: false });
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

async function listarImagenes(cliente = supabase) {
  const { data, error } = await cliente.storage.from(CUBO).list("", { limit: 1000 });
  if (error) fallo(error);
  return new Set((data || []).map((archivo) => archivo.name));
}

async function quitarImagen(nombre, cliente = supabase) {
  if (!nombre) return;
  const { error } = await cliente.storage.from(CUBO).remove([nombre]);
  if (error && !/not found/i.test(error.message)) fallo(error);
}

module.exports = { subirImagen, bajarImagen, quitarImagen, asegurarCubo, listarImagenes };
