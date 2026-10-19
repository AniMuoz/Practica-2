# Plan: roles y gestión de personal

Instrucciones para implementar más adelante. No cambia el login: el admin entra una vez con su contraseña y, con la sesión abierta, crea y elimina al resto de usuarios sin volver a escribirla.

Estado actual que hay que respetar:

- Tabla `usuarios` en `prog2/back/esquema.sql`: `usuario`, `clave_hash`, `creado_en`. Sin roles.
- Sesión en `prog2/back/auth.js`: cookie `HttpOnly` firmada. `protegerApi` pone `req.usuario`. `GET /api/sesion` devuelve solo `{ usuario }`.
- Altas hoy: `node crearUsuario.js <usuario> <contraseña>`, que hace `upsert` (pisa la clave si el nombre ya existe).
- Web: `prog2/web/src/main.jsx` (rutas), `Acceso.jsx` (login y `/api/sesion`), `Navbar.jsx`. `/admin` es la planilla de administración de stock, no de personas.

## 1. Datos

En `esquema.sql`, agregar la columna de forma idempotente:

```sql
alter table public.usuarios add column if not exists rol text not null default 'operador';
alter table public.usuarios drop constraint if exists usuarios_rol_check;
alter table public.usuarios add constraint usuarios_rol_check check (rol in ('admin', 'operador'));
```

Ejecutar ese `alter` en el SQL Editor de Supabase en las bases que ya existen. El `create table` solo corre en instalaciones nuevas; el `alter` cubre las actuales.

Roles:

- `admin`: lista, crea y elimina usuarios, resetea contraseñas ajenas y consulta la auditoría de bitácoras.
- `operador`: el resto de la app, como hoy. No ve personal ni auditoría.

El primer admin se marca a mano después de crearlo con el script:

```sql
update public.usuarios set rol = 'admin' where usuario = 'nombre';
```

`crearUsuario.js` sigue sirviendo para el alta inicial por consola. No hace falta pedirle el rol en el día a día.

## 2. Backend

Archivos: `auth.js`, un módulo nuevo `rutas/usuarios.js` registrado en `server.js` después de `protegerApi`, y `prog2/back/tests/auth.test.js`.

### Sesión

- `buscarUsuario` debe traer `usuario, clave_hash, rol`.
- `GET /api/sesion` y `POST /api/login` responden `{ usuario, rol }`.
- El rol se lee siempre de la base, no se guarda en la cookie. Así un cambio de rol aplica en cuanto vence la caché de usuario (30 s).

### Quién puede gestionar

Función `exigirAdmin(req)` usada solo en las rutas de personal:

- Sin sesión: 401 (ya lo cubre `protegerApi`).
- Sesión de `operador`: 403 con mensaje claro.
- Sesión de `admin`: sigue.

No volver a pedir la contraseña de admin en estas rutas.

### Rutas

| Método | Ruta | Quién | Efecto |
| --- | --- | --- | --- |
| GET | `/api/usuarios` | admin | Lista `{ usuario, rol, creado_en }`. Nunca devolver `clave_hash`. |
| POST | `/api/usuarios` | admin | Crea `{ usuario, clave, rol }`. |
| POST | `/api/usuarios/:nombre/clave` | admin | Resetea la contraseña de otro usuario. Cuerpo: `{ clave }`. |
| DELETE | `/api/usuarios/:nombre` | admin | Elimina a otro usuario. |

Reglas de `POST`:

- Normalizar el nombre: `trim` + minúsculas, igual que `guardarUsuario`.
- Rechazar nombre vacío o clave de menos de 8 caracteres (reusar `validarClaveNueva`).
- `rol` solo `admin` u `operador`. Si no viene, `operador`.
- Si el usuario ya existe, 409. No usar el `upsert` actual: pisaría la contraseña de alguien.
- Insertar el hash con `hashClave`. Invalidar `cacheUsuarios` de ese nombre.

Reglas de `DELETE`:

- 404 si no existe.
- 400 si el admin intenta borrarse a sí mismo (`req.usuario`).
- 400 si el objetivo es admin y es el único con `rol = 'admin'` (contar antes de borrar).
- Borrar la fila e invalidar su entrada en `cacheUsuarios`. Su cookie deja de servir porque `sesionDe` no encuentra el usuario.

Reglas del reset (`POST /api/usuarios/:nombre/clave`):

- Solo admin, sin volver a pedir su contraseña.
- 404 si el usuario no existe.
- 400 si el admin intenta resetear su propia clave por esta ruta. La propia clave sigue en `POST /api/cambiar-clave`, que pide la clave actual.
- Reusar `validarClaveNueva` (mínimo 8). Guardar un hash nuevo con `hashClave`. No usar el `upsert` de `guardarUsuario` si ese sigue pudiendo crear usuarios.
- Invalidar `cacheUsuarios` de ese nombre. La sal del hash cambia, y `versionDe` usa esa sal, así que las cookies viejas de esa persona dejan de valer en el próximo pedido.
- La respuesta es `{ ok: true, usuario }`. No devolver la clave.

No hace falta endpoint para cambiar el rol de un usuario ya creado.

## 3. Página de personal

Archivo nuevo `prog2/web/src/Personal.jsx`. Ruta en `main.jsx`:

```jsx
{ path: "/personal", element: <Personal /> },
```

Ponerla junto a `/` y `/admin`, dentro de `Marco`, para que pase por `Acceso`.

Contenido de la página:

- Título «Personal».
- Tabla con usuario, rol y fecha de alta. Datos de `GET /api/usuarios`.
- Formulario: nombre, contraseña inicial, repetir contraseña, selector de rol. Envío a `POST /api/usuarios`. Mostrar el error del JSON (`error`) si el status no es 2xx.
- Botón eliminar por fila, con confirmación. No mostrarlo en la fila del usuario de la sesión. `DELETE /api/usuarios/:nombre`.
- En cada fila que no sea la propia: «Nueva contraseña» y «Repetir», más un botón que llama a `POST /api/usuarios/:nombre/clave`. Mostrar el error del servidor si falla.
- Tras crear, borrar o resetear, volver a cargar la lista.

`Acceso.jsx` hoy guarda solo el nombre. Guardar también `rol` a partir de `/api/sesion` y del login, y pasarlo a la navbar (contexto pequeño o prop). En `Navbar.jsx`, enlaces «Personal» (`/personal`) y «Auditoría» (`/auditoria`) solo si `rol === "admin"`.

Ocultar el enlace no es la autorización. El 403 del servidor lo es. Si un operador abre `/personal` a mano, la página muestra el mensaje de error y no el formulario.

Estilos: reutilizar variables ya usadas (`--boton`, `--sobre`, `--apagado`) y `movil.css`. No hace falta un diseño nuevo.

## 4. Auditoría de bitácoras

Página de solo lectura para el admin. Revisa los folios que ya existen (`bitacora_folios`, `bitacora_filas`, `bitacora_firmas_historial`), incluidos los eliminados. No crea ni edita filas y no pide la clave de operación que usan `crearFolio` y `guardarFila`.

Hoy `leerFolio` rechaza un folio con `eliminado_en` (410) y no hay listado de folios. Esas rutas operativas se quedan igual para el operador.

### Rutas nuevas

Solo admin (`exigirAdmin`):

| Método | Ruta | Efecto |
| --- | --- | --- |
| GET | `/api/bitacora/auditoria` | Lista folios, activos y eliminados: `folio`, `creado_en`, `eliminado_en`. Orden `folio` descendente. |
| GET | `/api/bitacora/auditoria/:folio` | El folio aunque esté eliminado: filas (reusar `leerFilas`) e historial de firmas (reusar `leerHistorialFirmas`). 404 si no existe. |

Operador: 403 en ambas. No incluir la imagen de la firma en el listado; el historial ya guarda `firma_hash`, `firma_en`, `quitada_en` y `motivo`.

### Página

`prog2/web/src/Auditoria.jsx`, ruta en `main.jsx`:

```jsx
{ path: "/auditoria", element: <Auditoria /> },
```

Dentro de `Marco`. Contenido:

- Título «Auditoría de bitácoras».
- Tabla de folios con fecha de alta, estado (activo o eliminado) y fecha de eliminación.
- Al elegir un folio, detalle de filas (chofer, RUT, patente, ruta, fechas, km, observación) y el historial de firmas de ese folio.
- Sin botones de crear, editar, firmar ni eliminar.

Si un operador abre `/auditoria`, mostrar el 403 y no la tabla.

## 5. Pruebas

En `auth.test.js`, con la base falsa que ya simula `usuarios`:

- Login y `/api/sesion` incluyen `rol`.
- Operador: `GET/POST/DELETE /api/usuarios` y `POST /api/usuarios/:nombre/clave` → 403.
- Admin crea un operador y aparece en el listado, sin `clave_hash`.
- Crear un nombre repetido → 409 y la clave anterior sigue validando el login.
- Admin no puede borrarse.
- No se puede borrar al último admin.
- Admin borra a otro; el login y la cookie de ese otro dejan de valer.
- Clave corta al crear o al resetear → 400.
- Admin resetea la clave de otro: la clave vieja deja de entrar, la nueva entra y la cookie anterior queda inválida.
- Admin no puede resetear su propia clave por esa ruta.

En los tests de bitácora (`prog2/back/tests/bitacora.test.js` o `bitacoraBd.test.js`, el que ya monte la app):

- Operador: las dos rutas de auditoría → 403.
- Admin lista un folio activo y uno con `eliminado_en`.
- El detalle de un folio eliminado responde 200 con filas e historial, mientras `GET /api/bitacora/folios/:folio` sigue en 410.

Correr `node --test tests/auth.test.js` dentro de `prog2/back`, y el test de bitácora que se haya tocado.

## 6. Orden de trabajo

1. SQL en Supabase y en `esquema.sql`.
2. Marcar un usuario existente como `admin`.
3. `buscarUsuario`, login y `/api/sesion` con `rol`.
4. Rutas de listar, crear, resetear clave y eliminar.
5. Rutas de auditoría de bitácoras.
6. Tests de auth y de bitácora.
7. `Personal.jsx` y `Auditoria.jsx`, rutas y enlaces en la navbar.

## 7. Fuera de este plan

- Cambiar el rol de un usuario ya creado.
- Confirmación extra con la contraseña de admin en cada alta, baja o reset.
- Un registro aparte de quién creó, borró o reseteó usuarios. La auditoría de este plan revisa los folios de choferes, no las acciones de personal.
