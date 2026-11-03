/**
 * Asigna sub_ubicacion (primeros 4 caracteres de ubicacion) a los materiales
 * que tienen ubicacion pero sub_ubicacion vacia.
 *
 * Uso: node scripts/completarSubUbicacion.js          (solo lista)
 *      node scripts/completarSubUbicacion.js --aplicar (actualiza)
 */
const { supabase } = require("../supabase/supabase");

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const casos = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("materiales")
      .select("codigo,ubicacion,sub_ubicacion")
      .order("codigo")
      .range(desde, desde + 999);
    if (error) throw new Error(error.message);
    for (const fila of data) {
      const ubicacion = String(fila.ubicacion ?? "").trim();
      if (ubicacion && !String(fila.sub_ubicacion ?? "").trim()) {
        casos.push({ codigo: fila.codigo, ubicacion, sub_ubicacion: ubicacion.slice(0, 4) });
      }
    }
    if (data.length < 1000) break;
  }
  console.log(`Casos encontrados: ${casos.length}`);
  console.table(casos.slice(0, 50));
  if (!aplicar) return console.log("Simulación: no se modificó nada.");
  let ok = 0;
  for (const c of casos) {
    const { error } = await supabase.from("materiales").update({ sub_ubicacion: c.sub_ubicacion }).eq("codigo", c.codigo);
    if (error) console.error(c.codigo, error.message);
    else ok++;
  }
  console.log(`Actualizados: ${ok}/${casos.length}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
