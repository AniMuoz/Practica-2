const { guardarUsuario } = require("./auth");

const [nombre, clave] = process.argv.slice(2);

if (!nombre || !clave) {
  console.error("Uso: node crearUsuario.js <usuario> <contraseña>");
  process.exit(1);
}

guardarUsuario(nombre, clave)
  .then((usuario) => console.log(`Usuario "${usuario}" guardado.`))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
