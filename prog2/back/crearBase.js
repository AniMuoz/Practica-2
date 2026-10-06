/**
 * Crea una base vacía (berfre.sqlite) con el mismo esquema que hoy cubren
 * los Excel. No copia filas: sirve como punto de partida para migrar a la nube.
 *
 * Rombo, QR y Foto guardan el nombre del archivo de imagen, igual que el Excel.
 *
 * Uso: node crearBase.js
 */
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ARCHIVO_DB = path.join(__dirname, "berfre.sqlite");

const SQL = `
DROP TABLE IF EXISTS materiales;
DROP TABLE IF EXISTS contratistas;
DROP TABLE IF EXISTS reservas;
DROP TABLE IF EXISTS ultimas_cargas;

CREATE TABLE materiales (
  codigo TEXT PRIMARY KEY,
  descripcion TEXT NOT NULL DEFAULT '',
  ubicacion TEXT NOT NULL DEFAULT '',
  sub_ubicacion TEXT NOT NULL DEFAULT '',
  stock TEXT NOT NULL DEFAULT '',
  peso TEXT NOT NULL DEFAULT '',
  precio TEXT NOT NULL DEFAULT '',
  caracteristica TEXT NOT NULL DEFAULT '',
  stock_critico TEXT NOT NULL DEFAULT '',
  rombo TEXT NOT NULL DEFAULT '',
  qr TEXT NOT NULL DEFAULT '',
  foto TEXT NOT NULL DEFAULT '',
  inventario TEXT NOT NULL DEFAULT '',
  comentario TEXT NOT NULL DEFAULT '',
  marcado TEXT NOT NULL DEFAULT '',
  m502 TEXT NOT NULL DEFAULT '',
  m503 TEXT NOT NULL DEFAULT '',
  m504 TEXT NOT NULL DEFAULT '',
  m505 TEXT NOT NULL DEFAULT ''
);

CREATE TABLE contratistas (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL
);

CREATE TABLE reservas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orden TEXT NOT NULL DEFAULT '',
  n_reserva TEXT NOT NULL DEFAULT '',
  n_pos_reserva_traslado TEXT NOT NULL DEFAULT '',
  clase_de_registro TEXT NOT NULL DEFAULT '',
  fecha_de_necesidad TEXT NOT NULL DEFAULT '',
  clase_de_movimiento TEXT NOT NULL DEFAULT '',
  indicador_debe_haber TEXT NOT NULL DEFAULT '',
  material TEXT NOT NULL DEFAULT '',
  cantidad_necesaria TEXT NOT NULL DEFAULT '',
  cantid_reducidas TEXT NOT NULL DEFAULT '',
  cantidad_diferencia TEXT NOT NULL DEFAULT '',
  un_medida_de_entrada TEXT NOT NULL DEFAULT '',
  texto_breve_de_material TEXT NOT NULL DEFAULT '',
  almacen TEXT NOT NULL DEFAULT '',
  centro TEXT NOT NULL DEFAULT '',
  unidad_medida_base TEXT NOT NULL DEFAULT '',
  imputacion_reserva TEXT NOT NULL DEFAULT '',
  clase_de_necesidad TEXT NOT NULL DEFAULT '',
  ctd_en_um_entrada TEXT NOT NULL DEFAULT '',
  ctd_piezas_en_br TEXT NOT NULL DEFAULT '',
  ctd_verif_dispon TEXT NOT NULL DEFAULT '',
  movim_permitido TEXT NOT NULL DEFAULT '',
  nombre_del_usuario TEXT NOT NULL DEFAULT '',
  operacion TEXT NOT NULL DEFAULT '',
  posicion_borrada TEXT NOT NULL DEFAULT '',
  salida_final TEXT NOT NULL DEFAULT '',
  texto_de_clase_mov TEXT NOT NULL DEFAULT '',
  UNIQUE (orden, n_reserva, n_pos_reserva_traslado, material)
);

CREATE TABLE ultimas_cargas (
  clave TEXT PRIMARY KEY,
  fecha TEXT NOT NULL
);
`;

function crearBase() {
  const db = new DatabaseSync(ARCHIVO_DB);
  db.exec(SQL);
  db.close();
  return ARCHIVO_DB;
}

if (require.main === module) {
  console.log(`Base vacía creada en ${crearBase()}`);
}

module.exports = { crearBase, ARCHIVO_DB, SQL };
