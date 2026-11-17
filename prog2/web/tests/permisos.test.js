import assert from "node:assert/strict";
import test from "node:test";
import {
  esAdminVista,
  puedeGestionarBuzon,
  puedeVerBuzonAdmin,
  permisosDetalle,
  puedeSubirImagenMaterial,
} from "../src/lib/permisos.js";

test("permisosDetalle resume flags de ficha", () => {
  const m501 = permisosDetalle({ rol: "admin", bodega: "M501" });
  assert.equal(m501.puedeEditarDatosCompletos, true);
  assert.equal(m501.puedeEliminarMaterial, true);

  const lim = permisosDetalle({ rol: "operador", bodega: "M503" });
  assert.equal(lim.limitado, true);
  assert.equal(lim.puedeEditarObservaciones, true);
  assert.equal(lim.puedeEditarDatosCompletos, false);
  assert.equal(lim.etiquetaEdicion.includes("observaciones"), true);

  const ext = permisosDetalle({ rol: "admin_ext", bodega: "M501" });
  assert.equal(ext.esExt, true);
  assert.equal(ext.puedeEditarObservaciones, false);
  assert.equal(ext.puedeSubirImagen("QR"), true);
  assert.equal(ext.puedeSubirImagen("Foto"), false);
});

test("buzón: admin_ext ve y no gestiona", () => {
  const ext = { rol: "admin_ext", bodega: "M501" };
  assert.equal(puedeVerBuzonAdmin(ext), true);
  assert.equal(puedeGestionarBuzon(ext), false);
  assert.equal(esAdminVista(ext), true);
  assert.equal(puedeSubirImagenMaterial({ rol: "admin", bodega: "M502" }, "QR"), true);
});
