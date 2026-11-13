const assert = require("node:assert/strict");
const test = require("node:test");
const { registrar, activosDe, limpiar, reiniciar, VENTANA_MS } = require("../servicios/presencia");

test("un usuario activo aparece solo en su bodega", () => {
  reiniciar();
  const t = 1_000_000;
  registrar("ana", "admin", "M501", t);
  registrar("luis", "operador", "M502", t);
  assert.deepEqual(activosDe("M501", t + 30_000), [{ usuario: "ana", rol: "admin", hace_seg: 30 }]);
  assert.deepEqual(activosDe("M502", t).map((u) => u.usuario), ["luis"]);
});

test("un usuario vencido desaparece y la limpieza lo borra", () => {
  reiniciar();
  const t = 5_000_000;
  registrar("ana", "admin", "M501", t);
  assert.equal(activosDe("M501", t + VENTANA_MS + 1).length, 0);
  limpiar(t + VENTANA_MS + 1);
  assert.equal(activosDe("M501", t).length, 0);
});

test("al cambiar de bodega el usuario se mueve a la nueva", () => {
  reiniciar();
  registrar("ext", "admin_ext", "M501", 1000);
  registrar("ext", "admin_ext", "M503", 2000);
  assert.equal(activosDe("M501", 2000).length, 0);
  assert.equal(activosDe("M503", 2000).length, 1);
});
