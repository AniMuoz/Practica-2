# Practica-2
Proyectos y programas realizados durante la práctica 2 UNAB para digitalizar inventario, gastos y bitácoras.

Detalle técnico (endpoints, esquema, comandos): ver [`DOCUMENTACION.md`](DOCUMENTACION.md). Manuales de usuario en `manual de uso/`.

## Proyecto Python (programa_1)
- La empresa necesita un método para hacer planillas de inventario más fácil y que todos tengan las mismas planillas.
- Son programas que facilitan el trabajo de los trabajadores en materia de transformación digital.
- Interfaz web local con Flask (`front_flask.py` + `Berfre.py`): stock, bodega, inventario, reservas, ventas y diccionarios.

## Proyecto React (prog2)
Aplicación web para marcar y revisar el inventario de forma compartida, sin papel. Todos los usuarios ven los cambios al instante (SSE).

**Qué permite hacer**
- Ver, buscar y filtrar el inventario por bodega, sub-ubicación, stock, precio y materiales marcados.
- Editar materiales, marcarlos, subir fotos, QR y rombo.
- Importar planillas Excel (SAP, precios, ubicaciones, reservas) y exportar planillas de stock, bodega, inventario, movimientos, stock detallado y reservas.
- Revisar reservas desde un PDF, registrar ventas mensuales y administrar contratistas.
- Llevar la bitácora de camión con folios, filas, firmas e historial.
- Generar códigos QR por material (`/qr`).
- Armar la planilla de gastos mensual (panel en `/admin`; la ruta `/gastos` redirige ahí).
- Buzón de mensajes entre operadores y administradores (`/buzon`).
- Gestionar usuarios y roles (`admin`, `operador`, `desactivado`) en `/personal`, con auditoría en `/auditoria`.

**Cómo está armado**
- **Web (`prog2/web`):** React 19 + Vite, publicada en Cloudflare Pages. El Worker reenvía lo que empieza con `/api` al servidor.
- **Servidor (`prog2/back`):** Express en Render; procesa peticiones, genera Excel/PDF y valida sesión.
- **Base de datos:** Supabase (tablas e imágenes).

El flujo es: el navegador pide todo a Cloudflare, que reenvía `/api` al servidor en Render, y este consulta Supabase.

**Pantallas**
| Ruta | Uso |
|---|---|
| `/` | Tabla de inventario |
| `/admin` | Cargas Excel, planillas, reservas, ventas, contratistas, bitácora y gastos |
| `/personal` | Usuarios y cambio de clave |
| `/auditoria` | Auditoría de bitácora |
| `/qr` | Generador de QR |
| `/buzon` | Mensajes / novedades |
| `/:codigo` | Ficha de un material |

**Inicio de sesión y seguridad**
- Hay que iniciar sesión con usuario y contraseña. La sesión dura 7 días.
- Roles: el operador puede ver, filtrar y descargar; las escrituras delicadas (salvo gastos y buzón) exigen rol `admin`.
- Las acciones delicadas piden además la clave compartida (`CLAVE_DATOS`).
- El servidor limita los intentos de login y la cantidad de peticiones por minuto.
- La clave compartida se bloquea por IP durante 15 minutos tras 3 intentos fallidos (`prog2/back/seguridad/limiteClave.js`).
- En producción el Worker autentica al servidor con `SECRETO_PROXY`; sin él (y sin `SESSION_SECRET`) el arranque falla.
- Solo los orígenes listados en `ALLOWED_ORIGINS` pueden usar CORS hacia el servidor.

**Variables de entorno en Render**
- `SESSION_SECRET`: texto largo y aleatorio que protege las sesiones. Sin él, las sesiones se cierran cada vez que Render reinicia.
- `SECRETO_PROXY`: secreto compartido con el Worker de Cloudflare (obligatorio en producción).
- Claves de conexión a Supabase y `CLAVE_DATOS`.
- Opcionales: `ALLOWED_ORIGINS`, `RATE_LIMIT_POR_MINUTO` (por defecto 600) y `MAX_CONEXIONES_EVENTOS` (por defecto 100).

**Usuarios**
```bash
cd prog2/back
node scripts/crearUsuario.js <usuario> <contraseña>
```

**Orden del código del servidor**
- `server.js`: configuración, `/healthz`, imágenes, SSE y arranque.
- `rutas/`: materiales, planillas, reservas, ventas, bitácora, usuarios, gastos y buzón.
- `seguridad/`: sesiones (`auth.js`), CORS/límites/proxy (`seguridad.js`), clave compartida y restricción de escrituras (`soloAdmin.js`).
- `servicios/`: lógica de negocio (datos, planillas, reservas, ventas, gastos, etc.).
- `supabase/` y `utils/`: cliente de BD, imágenes y estado compartido.
- `scripts/`: `crearUsuario.js`, `crearBase.js`.

**Probar y revisar**
```bash
# Local con Docker (back :3001, web :5173)
docker compose up --build

# Pruebas
cd prog2/back && npm test
cd prog2/web && npm test
```
- En GitHub Actions se ejecutan lint y pruebas en cada cambio (`.github/workflows/tests.yml`).
- `/healthz` responde `{"ok":true}` cuando el servidor está vivo (Health Check Path en Render).
- `/healthz/db` comprueba además la conexión a Supabase (lo usa el cron del Worker).

## Proyecto gastos (programa_3)
- Planilla de gastos mensual con Flask (`Planilla_gastos_test.py`), basada en planillas de un contador.
- Se añaden los datos de las boletas, se elige el mes y se genera el detalle en Excel.
- Se pueden exportar los datos sin procesar para reimportarlos después.
- Su funcionalidad ya está integrada en `prog2` (panel Gastos en `/admin`); esta versión se conserva como respaldo offline.
- Empaquetado: ver `programa_3/para buildear.txt`.

## Proyecto bitácora de camión (programa_4)
- Programa con pantalla web (Flask) para llenar la bitácora de un camión: fecha, chofer, RUT, patente, ruta, horas, kilómetros, observación y firma.
- No usa base de datos: lo que se escribe vive en el navegador y el programa solo genera el Excel.
- Calcula el recorrido a partir del kilómetro inicial y el final.
- Permite abrir un Excel generado antes para seguir editando ese folio.
- Se puede empaquetar como programa de escritorio (ver `programa_4/build.txt`).
- La versión web equivalente está dentro de `prog2` (panel Bitácora en `/admin`).

## Proyecto códigos QR (programa_5)
- Genera un código QR por cada material para pegarlo en la bodega.
- Se elige el Excel de inventario y se toman los materiales de la bodega M501 que tienen stock.
- Cada QR abre la página del material en la aplicación web (`.../<código del material>`).
- Tiene una ventana sencilla (`frontend_qr.py`) donde se elige el archivo, la carpeta de destino, la bodega y la dirección web, con barra de progreso. Variante `frontend_qr_nuevos.py` para omitir los que ya tienen QR.
- Las imágenes se guardan en la carpeta `QRmateriales`, que no se sube a git.
- Instrucciones para crear el ejecutable en `programa_5/build.txt`.
- En `prog2` también hay generador web en `/qr`.
