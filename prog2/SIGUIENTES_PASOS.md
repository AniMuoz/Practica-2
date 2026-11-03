# Siguientes pasos de mejora (prog2)

La migracion de `xlsx` se resolvio de otra forma (ver abajo) y la division de `Admin.jsx` queda parcial por riesgo. Todo lo hecho deja los tests en verde (back 344, web 40 + 5 de UI) y `npm run build` funcionando. No se toco `trust proxy`.

## Ya hecho
- `fs` asincrono: `rutas/materiales.js` usa `fs.promises.readFile`; `nucleoDatos.js` usa `fs.promises.rm(..., { force: true })`.
- `server.js`: las imagenes locales se suben en segundo plano tras `listen` y solo si no estan ya en el bucket (`listarImagenes` en `imagenesSupabase.js`).
- `auth.js`: limite de 30 fallos por nombre de usuario (ademas de 10 por IP) en `/login` y `/cambiar-clave`, con test.
- `rutas/usuarios.js`: verificado que cada alta, cambio de rol y cambio de clave invalida `cacheUsuarios`; comentario sobre los contadores en memoria (una sola instancia).
- ESLint (`eslint.config.js`) en `back` y `web`, script `npm run lint` y paso en el CI. Quedan 2 avisos en los tests del back (`consulta`, `parseado`); los de `indiceCodigo` y `firmaComoPng` ya se resolvieron.
- Tests de UI con vitest + testing-library: `web/tests-ui/Acceso.test.jsx` (5 tests). `npm test` en web ejecuta ambos runners.
- Cobertura (`--experimental-test-coverage`) y `npm audit --omit=dev` en el CI.

## Resuelto: dependencia `xlsx`
En lugar de reescribir todo con `exceljs` (las funciones de lectura son sincronas y habria que volver asincrono el codigo), `xlsx` se actualizo a la version oficial 0.20.3 de SheetJS (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`), que corrige las vulnerabilidades de la 0.18.5 de npm y mantiene la misma API. `npm audit --omit=dev` ya no la reporta (solo quedan 2 avisos moderados de `uuid` via `exceljs`). Los 344 tests del back siguen en verde. Migrar a `exceljs` ya no es necesario.

## Avance en `web/src/Admin.jsx`
Ya existe el cliente `src/api.js` (todos los `fetch` de `Admin.jsx` lo usan), el hook `src/useEsMovil.js` (usado en `Admin` y `Detalle`) y el panel `admin/PanelContratistas.jsx` con tests. Quedan por migrar a `api.js` los `fetch` de `Detalle.jsx`, `Bitacora.jsx`, `Ventas.jsx`, `Gastos.jsx`, `App.jsx` y otros, y extraer el resto de paneles.

## Division de `Admin.jsx`: avance (pasos 0 a 4 hechos)
- Paso 0: `tests-ui/Admin.test.jsx` fija el comportamiento (carga inicial, paneles exclusivos, refresco por SSE con rebote, errores, contratistas). Correr `npm test` tras cada paso.
- Paso 1: funciones puras en `admin/utilidades.js` (con `tests/utilidadesAdmin.test.js`).
- Paso 2: `admin/useCargaPlanilla.js` (bodega, regional, inventario, movimientos y detallado).
- Paso 3: `admin/useUltimasCargas.js`.
- Paso 4: `admin/useContratistas.js` (lo usa tambien Ventas via `listaContratistas`).
- Tests de los hooks: `tests-ui/hooksAdmin.test.jsx`.
- Pasos 5 a 9 hechos: hooks `usePaneles`, `useSalidaSegura`, `useRefrescoSse`, `useDetallado` y paneles `PanelBodega`, `PanelRegional`, `PanelInventario`, `PanelMovimientos`, `PanelReserva` (queda montado oculto para conservar la busqueda), `PanelCarga`, `PanelFormulario` y `PanelDetallado` (tests en `PanelesStock.test.jsx`, `useDetallado.test.jsx`, `hooksAdmin2.test.jsx`). `Admin.jsx` bajo de ~2000 a ~950 lineas. `PanelCarga` y `PanelFormulario` reciben el envio desde `Admin` (`enviarCarga`, `enviarAlta`). Pendiente opcional: mover esos dos envios a hooks, la barra de botones y los dialogos de confirmacion.

## Mantener despiertos Render y Supabase
`worker.js` tiene un handler `scheduled` (cron en `wrangler.jsonc`): cada 14 min llama a `/healthz` de Render y una vez al dia (12:00 UTC) tambien a `/healthz/db`, que consulta Supabase (`back/salud.js`). Cuesta unas 103 invocaciones diarias del Worker. Ojo con las horas gratis de Render (~750 al mes): un solo servicio las consume casi todas.

## Pendiente (original): dividir `web/src/Admin.jsx`
Ya se extrajeron los componentes puros `web/src/admin/VistaPrevia.jsx` e `Interruptor.jsx`. Lo que queda es el componente `Admin` (~2000 lineas): mas de 100 variables de estado compartidas entre todas las secciones (carga, formulario, bodega, regional, inventario, detallado, reserva, contratistas, bitacora, ventas) y funciones que se llaman entre si (`refrescarVistas`, `cerrarPaneles`, `cargarPlanilla`). Dividirlo sin poder probar la interfaz a mano es riesgoso; sugerencia: 
1. Crear hooks por seccion (`useBodega`, `useReserva`, `useVentas`, ...) que agrupen su estado y sus llamadas de red, empezando por la mas aislada (Contratistas).
2. Extraer luego el JSX de cada panel a `web/src/admin/Panel<Seccion>.jsx`, pasando por props lo compartido.
3. Tras cada extraccion: `npm run lint`, `npm run build` y revisar la pantalla a mano.
4. Mismo tratamiento mas adelante para `Detalle.jsx` y `App.jsx`.

## Otros pendientes menores
- Anadir tests de UI para `Navbar.jsx` (necesita envolver en `MemoryRouter` de `react-router-dom`).
- Revisar los 4 avisos de ESLint y decidir si se endurece la regla (`no-unused-vars` a `error`).
- `trust proxy`: sigue pendiente por decision del usuario (necesita saber cuantos proxies hay delante de la API).
