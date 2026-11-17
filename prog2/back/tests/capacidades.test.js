const assert = require("node:assert/strict");
const test = require("node:test");
const {
  esAdminVista,
  esAdminM501,
  esAdminM501oExt,
  esBodegaLimitada,
  puedeVerBuzonAdmin,
  puedeGestionarBuzon,
  puedeEditarObservaciones,
  puedeSubirImagenMaterial,
} = require("../seguridad/capacidades");

test("admin_ext ve buzón pero no lo gestiona", () => {
  const ext = { rol: "admin_ext", bodega: "M501" };
  assert.equal(puedeVerBuzonAdmin(ext), true);
  assert.equal(puedeGestionarBuzon(ext), false);
  assert.equal(puedeEditarObservaciones(ext), false);
  assert.equal(puedeSubirImagenMaterial(ext, "QR"), true);
  assert.equal(puedeSubirImagenMaterial(ext, "Foto"), false);
});

test("admin de otra bodega es limitado y puede observaciones", () => {
  const admin502 = { rol: "admin", bodega: "M502" };
  assert.equal(esBodegaLimitada(admin502), true);
  assert.equal(esAdminM501(admin502), false);
  assert.equal(puedeEditarObservaciones(admin502), true);
  assert.equal(puedeSubirImagenMaterial(admin502, "Foto"), true);
  assert.equal(puedeSubirImagenMaterial(admin502, "QR"), true);
});

test("admin M501 y ext cubren auditoría", () => {
  assert.equal(esAdminM501oExt({ rol: "admin", bodega: "M501" }), true);
  assert.equal(esAdminM501oExt({ rol: "admin_ext", bodega: "M503" }), true);
  assert.equal(esAdminM501oExt({ rol: "admin", bodega: "M502" }), false);
  assert.equal(esAdminVista({ rol: "operador", bodega: "M501" }), false);
});
