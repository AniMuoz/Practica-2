const fs = require("fs");
const { supabase } = require("./supabase");

const trabajo = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

async function leer(tabla) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from(tabla).select("*").range(desde, desde + 999);
    if (error) throw new Error(error.message);
    filas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return filas;
}

async function reemplazar(tabla, filas, columna) {
  const { error: borrado } = await supabase.from(tabla).delete().not(columna, "is", null);
  if (borrado) throw new Error(borrado.message);
  for (let inicio = 0; inicio < filas.length; inicio += 400) {
    const lote = filas.slice(inicio, inicio + 400);
    const { error } = await supabase.from(tabla).insert(lote);
    if (error) throw new Error(error.message);
  }
}

async function guardarCarga(fila) {
  const { error } = await supabase.from("ultimas_cargas").upsert(fila);
  if (error) throw new Error(error.message);
}

async function main() {
  if (trabajo.operacion === "leer") {
    process.stdout.write(JSON.stringify(await leer(trabajo.tabla)));
    return;
  }
  if (trabajo.operacion === "reemplazar") {
    await reemplazar(trabajo.tabla, trabajo.filas, trabajo.columna);
    return;
  }
  if (trabajo.operacion === "carga") {
    await guardarCarga(trabajo.fila);
    return;
  }
  throw new Error("Operación desconocida.");
}

main().catch((error) => {
  process.stderr.write(error.message);
  process.exit(1);
});
