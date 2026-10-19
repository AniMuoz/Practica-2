# Practica-2
Proyectos y programas realizados durante la práctica 2 UNAB.

## Proyecto Python (programa_1)
- La empresa necesita un método para hacer planillas de inventario más fácil y que todos tengan las mismas planillas.
- Son programas que facilitan el trabajo de los trabajadores en materia de transformación digital.

## Proyecto React (prog2)
Aplicación web para marcar y revisar el inventario de forma compartida, sin papel. Todos los usuarios ven los cambios al instante.

**Qué permite hacer**
- Ver, buscar y filtrar el inventario por bodega, stock, precio y materiales marcados.
- Editar materiales, marcarlos, subir fotos, QR y rombo.
- Importar planillas Excel (SAP, precios, ubicaciones, reservas) y exportar planillas de stock, inventario y reservas.
- Revisar reservas desde un PDF, registrar ventas y administrar contratistas.
- Llevar la bitácora con folios, filas y firmas.

**Cómo está armado**
- **Web (`prog2/web`):** la pantalla que ve el usuario, publicada en Cloudflare.
- **Servidor (`prog2/back`):** procesa las peticiones, genera los Excel y revisa la sesión. Corre en Render.
- **Base de datos:** Supabase, donde se guardan los datos y las imágenes.

El flujo es: el navegador pide todo a Cloudflare, que reenvía lo que empieza con `/api` al servidor en Render, y este consulta Supabase.

**Inicio de sesión y seguridad**
- Hay que iniciar sesión con usuario y contraseña. La sesión dura 7 días.
- Las acciones delicadas piden además una clave.
- El servidor limita los intentos de login y la cantidad de peticiones por minuto.
- Solo el sitio publicado puede usar el servidor (CORS cerrado, salvo que se agreguen orígenes).

**Variables de entorno en Render**
- `SESSION_SECRET`: texto largo y aleatorio que protege las sesiones. Sin él, las sesiones se cierran cada vez que Render reinicia.
- Las claves de conexión a Supabase y la clave de datos.
- Opcionales: `ALLOWED_ORIGINS` (otros sitios autorizados), `RATE_LIMIT_POR_MINUTO` (por defecto 600) y `MAX_CONEXIONES_EVENTOS` (por defecto 100).

**Usuarios**
- Se crean con `node crearUsuario.js <usuario> <contraseña>` dentro de `prog2/back`.

**Probar y revisar**
- En `prog2/back` y `prog2/web`, `npm test` ejecuta las pruebas. En GitHub se ejecutan solas en cada cambio.
- `/healthz` responde `{"ok":true}` cuando el servidor está vivo. Sirve como *Health Check Path* en Render.

**Orden del código del servidor**
- `server.js`: configuración y arranque.
- `rutas/`: las rutas por tema (planillas, reservas, ventas, bitácora y materiales).
- `seguridad.js` y `auth.js`: protección y sesiones.

## Proyecto gastos (programa_3)
- Proyecto Python con frontend Flask que busca generar planillas de gastos.
- Las planillas están basadas en algunas hechas por un contador.
- Se añaden los datos de las boletas.
- Se pueden exportar los datos sin procesar para reimportarlos en algún caso.
- Se debe elegir el mes del que se generará la planilla.

## Proyecto bitácora de camión (programa_4)
- Programa con pantalla web (Flask) para llenar la bitácora de un camión: fecha, chofer, RUT, patente, ruta, horas, kilómetros, observación y firma.
- No usa base de datos: lo que se escribe vive en el navegador y el programa solo genera el Excel.
- Calcula solo el recorrido a partir del kilómetro inicial y el final.
- Permite abrir un Excel generado antes para seguir editando ese folio.
- Se puede empaquetar como programa de escritorio (ver `programa_4/build.txt`).
- La versión web de la bitácora está dentro del proyecto React (`prog2`).

## Proyecto códigos QR (programa_5)
- Genera un código QR por cada material para pegarlo en la bodega.
- Se elige el Excel de inventario y se toman los materiales de la bodega M501 que tienen stock.
- Cada QR abre la página del material en la aplicación web (`.../<código del material>`).
- Tiene una ventana sencilla (`frontend_qr.py`) donde se elige el archivo, la carpeta de destino, la bodega y la dirección web, con barra de progreso.
- Las imágenes se guardan en la carpeta `QRmateriales`, que no se sube a git.
- Instrucciones para crear el ejecutable en `programa_5/build.txt`.