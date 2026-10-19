const { guardarUsuario } = require("./auth");

const [nombre, clave, rol] = process.argv.slice(2);

if (!nombre || !clave || (rol && rol !== "admin" && rol !== "operador")) {
  console.error("Uso: node crearUsuario.js <usuario> <contraseña> [admin|operador]");
  process.exit(1);
}

guardarUsuario(nombre, clave, rol)
  .then((usuario) => console.log(`Usuario "${usuario}" guardado${rol ? ` con rol ${rol}` : ""}.`))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
