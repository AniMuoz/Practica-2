# DocumentaciÃ³n de Practica-2

Conjunto de programas hechos durante la prÃ¡ctica 2 (UNAB) para digitalizar el trabajo de inventario, gastos y bitÃ¡coras de una empresa.

| Carpeta | Programa | TecnologÃ­a |
|---|---|---|
| `programa_1` | Planillas de inventario (stock, bodega, reservas, ventas) | Python, Flask, openpyxl |
| `prog2` | AplicaciÃ³n web compartida de inventario y bitÃ¡cora | Node/Express + React/Vite, Supabase |
| `programa_3` | Planilla de gastos mensual | Python (escritorio), openpyxl |
| `programa_4` | BitÃ¡cora de camiÃ³n | Python, Flask, Excel |
| `programa_5` | Generador de cÃ³digos QR por material | Python, tkinter, qrcode |

Otros archivos de la raÃ­z: `docker-compose.yml` (levanta back y web), `.github/workflows/tests.yml` (CI), `Estructura_migracion.MD`, `manual de uso/` (manual para usuarios), `tutoriales.txt`.

---

## 1. prog2 (aplicaciÃ³n web)

### 1.1 PropÃ³sito
Marcar y revisar inventario de forma compartida y sin papel. Todos los usuarios ven los cambios al instante (eventos SSE).

Funciones:
- Ver, buscar y filtrar inventario por bodega, sub-ubicaciÃ³n, stock, precio y marcados.
- Editar materiales, marcarlos, subir fotos, QR y rombo.
- Importar Excel (SAP, precios, ubicaciones, reservas) y exportar planillas (stock, bodega, regional, inventario, stock detallado, reservas).
- Revisar reservas desde un PDF, registrar ventas, administrar contratistas.
- BitÃ¡cora de camiÃ³n con folios, filas y firmas (con historial de firmas quitadas).
- GestiÃ³n de usuarios y roles (`admin`, `operador`, `desactivado`) y auditorÃ­a.

### 1.2 Arquitectura

```
Navegador â”€â”€> Cloudflare (Pages + Worker) â”€â”€/apiâ”€â”€> Servidor Express (Render) â”€â”€> Supabase (BD + imÃ¡genes)
```

- **`prog2/web`**: interfaz React 19 + Vite + react-router. El Worker (`worker.js`, `functions/api/[[path]].js`) reenvÃ­a lo que empieza con `/api` al servidor.
- **`prog2/back`**: API Express que valida sesiÃ³n, procesa datos, genera Excel (`exceljs`, `xlsx`), lee PDF (`pdf-parse`) y consulta Supabase.
- **Supabase**: tablas y bucket de imÃ¡genes.
- **`prog2/cloudflared/config.yml`**: configuraciÃ³n de tÃºnel Cloudflare.

### 1.3 Servidor (`prog2/back`)

| Archivo | FunciÃ³n |
|---|---|
| `server.js` | ConfiguraciÃ³n Express, `/healthz`, imÃ¡genes, eventos SSE, registro de rutas, arranque y cierre limpio (SIGTERM/SIGINT). |
| `auth.js` | Login, logout, sesiÃ³n (cookie, 7 dÃ­as), cambio de clave, lÃ­mite de fallos por IP (10) y por usuario (30). Rutas pÃºblicas: `/login`, `/logout`, `/sesion`, `/cambiar-clave`. |
| `seguridad.js` | CORS, cabeceras seguras, lÃ­mite de peticiones por minuto, mÃ¡ximo de conexiones SSE. |
| `compartido.js` | Estado compartido: carpeta de imÃ¡genes, clientes SSE, colores. |
| `fuenteDatos.js`, `nucleoDatos.js` | Carga/precarga de datos, cachÃ© y lÃ³gica base de la tabla de materiales. |
| `planillasStock.js` | ConstrucciÃ³n de planillas de stock, bodega, regional e inventario. |
| `reservasDatos.js` | Lectura y cruce de reservas (PDF/Excel). |
| `ventas.js`, `ventasBd.js`, `contratistas.js` | Lectura de Ã³rdenes/traspasos, planilla de ventas mensual en Supabase (`ventas_planillas`, `ventas_filas`, `ventas_log`) y contratistas. |
| `bitacora.js` | Folios, filas y firmas de la bitÃ¡cora. |
| `importaciones.js` | ImportaciÃ³n de Excel (SAP, precios, ubicaciones). |
| `supabase.js`, `supabaseTablas.js`, `supabaseTarea.js` | Cliente y acceso a tablas de Supabase. |
| `imagenesSupabase.js` | Subir, bajar y listar imÃ¡genes del bucket. |
| `crearBase.js`, `esquema.sql` | CreaciÃ³n del esquema de la base. |
| `crearUsuario.js` | Script CLI para crear usuarios. |
| `gastos.js` | LÃ³gica de la planilla de gastos mensual (port de `programa_3`). |
| `eslint.config.js`, `Dockerfile` | Reglas de lint e imagen Docker del servidor. |
| `rutas/` | Rutas por tema: `materiales`, `planillas`, `reservas`, `ventas`, `bitacora`, `usuarios`, `gastos`. |
| `tests/` | Pruebas con `node --test`. |

#### Endpoints de la API (todos bajo `/api`, requieren sesiÃ³n salvo los pÃºblicos)

**SesiÃ³n** (`auth.js`)
- `POST /login`, `POST /logout`, `GET /sesion`, `POST /cambiar-clave`

**Sistema** (`server.js`)
- `GET /healthz` (pÃºblica, sin prefijo `/api`)
- `GET /api/eventos` (SSE), `GET /api/imagenes/:nombre`, `GET /api/supabase` (estado de conexiÃ³n)

**Materiales** (`rutas/materiales.js`)
- `GET /tabla`, `GET /tabla/ultimas-cargas`, `POST /tabla/excel` (importar), `POST /tabla/limpiar-inventario`
- `GET /buscar`
- `GET|POST /material`, `GET|PUT|DELETE /material/:codigo`
- `PUT /material/:codigo/marcado`, `PUT /material/:codigo/datos`
- `POST|DELETE /material/:codigo/imagen`
- `GET|POST /acceso` (clave para acciones delicadas)

**Planillas** (`rutas/planillas.js`) â€” cada una con variante `/excel`
- `GET /tabla/excel`, `/bodega`, `/regional`, `/inventario`, `/inventario-bodega`, `/stock-detallado`

**Reservas y ventas** (`rutas/reservas.js`, `rutas/ventas.js`)
- `GET /reservas`, `GET /reservas/excel`, `POST /reserva`, `POST /reserva/excel`
- `POST /ventas` (aÃ±ade a la planilla del mes), `GET /ventas/planilla?anio&mes`, `GET /ventas/meses`, `GET /ventas/descargar?anio&mes` (`VENTAS dd-mm-aaaa.xlsx`), `GET /ventas/descargar-anual`, `PATCH|DELETE /ventas/filas/:id`, `DELETE /ventas/ordenes/:planilla/:lote`, `GET /ventas/auditoria`, `/ventas/auditoria/log`, `/ventas/auditoria/:id` (admin), `GET|PUT /contratistas`

**Gastos** (`rutas/gastos.js`, solo admin)
- `GET /gastos/topicos`, `POST /gastos/procesar`, `POST /gastos/guardar`, `POST /gastos/recuperar`

**BitÃ¡cora** (`rutas/bitacora.js`)
- `POST /bitacora/folios`, `GET /bitacora/folios/ultimo`, `GET|DELETE /bitacora/folios/:folio`, `GET /bitacora/folios/:folio/excel`
- `PUT|DELETE /bitacora/folios/:folio/filas/:fila`
- `POST|DELETE /bitacora/folios/:folio/filas/:fila/firma`
- `GET /bitacora/auditoria`, `GET /bitacora/auditoria/:folio`

**Usuarios** (`rutas/usuarios.js`, solo admin)
- `GET|POST /usuarios`, `POST /usuarios/:nombre/rol`, `POST /usuarios/:nombre/clave`, `DELETE /usuarios/:nombre`

#### Base de datos (`esquema.sql`)
- `planillas(nombre, matriz jsonb)`
- `usuarios(usuario, clave_hash, rol, creado_en)` con RLS
- `ultimas_cargas(clave, fecha)`
- `bitacora_folios(folio, creado_en, eliminado_en)`
- `bitacora_filas(folio, n_fila, fecha, chofer, rut, patente, ruta, h_salida, h_llegada, km_ini, km_term, km_reco, observacion, firma, firma_hash, firma_datos, firma_en)`
- `bitacora_firmas_historial(id, folio, n_fila, firma, firma_hash, firma_en, quitada_en, motivo)`

#### Variables de entorno
| Variable | Uso |
|---|---|
| `SESSION_SECRET` | Protege las sesiones (sin Ã©l se cierran al reiniciar). |
| Claves de Supabase | ConexiÃ³n a BD e imÃ¡genes (ver `.env`, no se sube a git). |
| `ALLOWED_ORIGINS` | (opcional) OrÃ­genes CORS adicionales. |
| `RATE_LIMIT_POR_MINUTO` | (opcional) Por defecto 600. |
| `MAX_CONEXIONES_EVENTOS` | (opcional) Por defecto 100. |
| `PORT` | Puerto del servidor (3001 por defecto). |

#### Comandos
```bash
cd prog2/back
npm install
npm start                                   # API en http://localhost:3001
npm test                                    # pruebas
npm run lint
node crearUsuario.js <usuario> <contraseÃ±a> # crear usuario
```

### 1.4 Web (`prog2/web`)

Rutas de la interfaz (`src/main.jsx`):

| Ruta | Componente | DescripciÃ³n |
|---|---|---|
| `/` | `App.jsx` | Tabla de inventario con filtros, paginaciÃ³n (100), marcado y descarga. |
| `/admin` | `Admin.jsx` | Panel: cargas de Excel, planillas, reservas, ventas, contratistas, bitÃ¡cora. |
| `/personal` | `Personal.jsx` | GestiÃ³n de usuarios y cambio de clave. |
| `/auditoria` | `Auditoria.jsx` | AuditorÃ­a de la bitÃ¡cora. |
| `/gastos` | `Gastos.jsx` | Planilla de gastos mensual (solo admin). Port web de `programa_3`: lÃ³gica en `back/gastos.js`, rutas `/api/gastos/*` en `back/rutas/gastos.js`; guarda/recupera datos sin procesar en xlsx (mismo formato de 5 columnas) y genera el detalle mensual. |
| `/qr` | `GeneradorQr.jsx` | Generador de QR (usa `generarQr.js`, `qrcode`, `jszip`). |
| `/:codigo` | `Detalle.jsx` | Ficha de un material. |

Otros: `Acceso.jsx` (login), `Navbar.jsx`, `Planilla.jsx`, `Ventas.jsx` (planilla mensual de ventas y auditorÃ­a), `Bitacora.jsx`, `FiltrosTabla.jsx`, `ColoresPlanilla.jsx`, `Recorrido.jsx` (tutorial guiado), `reglasPlanilla.js` (filtros, colores y paginaciÃ³n puros), `admin/` (componentes `VistaPrevia`, `Interruptor`), estilos `admin.css` y `movil.css`.

Despliegue: `incrustar-api.js`/`api-build.js`/`aplicar-env.js` inyectan la URL de la API al build; `wrangler.jsonc` configura Cloudflare; `public/_headers` define cabeceras.

```bash
cd prog2/web
npm install
npm run dev      # http://localhost:5173
npm run build
npm test         # node --test + vitest
```

### 1.5 Docker
```bash
docker compose up --build   # back en :3001, web en :5173 (API_PROXY=http://back:3001)
```

### 1.6 Diagramas y planes
- `prog2/Diagrama programa 2/Diagrama programa 2.drawio`
- `prog2/back/Diagrama programa back/diagrama.md` y `prog2/web/Diagrama programa web/diagrama.md` (Mermaid)
- `prog2/PLAN_gestion_usuarios.md`, `prog2/SIGUIENTES_PASOS.md` (pendientes: dividir `Admin.jsx`, avisos ESLint, `trust proxy`), `prog2/por hacer.txt`, `prog2/crear usuarios.txt`.

### 1.7 Pruebas y CI
Back: 20 archivos en `tests/`. Web: `tests/` (node: `generarQr`, `worker`, `reglasPlanilla`, `filtrosPlanilla`) y `tests-ui/` (vitest + testing-library: `Acceso`, `Gastos`, `GeneradorQr`, `Ventas`). GitHub Actions ejecuta lint, pruebas, cobertura y `npm audit`.

---

## 2. programa_1 (planillas de inventario, Flask)

Facilita que todos usen las mismas planillas. Interfaz web local (`templates/`: `front.html`, `tarjetas.html`, `ventas_form.html`, `diccionario_mod.html`) servida por `front_flask.py`, con lÃ³gica en `Berfre.py`.

Funciones (rutas de `front_flask.py`):
- **Stock**: vista previa y descarga (`stock_*`, `stock_det_*`).
- **Bodega** e **Inventario**: vista previa y descarga.
- **Reserva**: vista previa, descarga y reselecciÃ³n desde PDF.
- **Ventas**: formulario y procesamiento.
- **Diccionarios** (materiales, precios, ubicaciones): agregar, modificar, eliminar, exportar/importar Excel, importar archivos oficiales de precios/ubicaciones, recargar.
- **Tarjetas** de materiales, `apagar` y apertura automÃ¡tica del navegador.

Dependencias: `requirements.txt` (`flask`, `openpyxl`); `Berfre.py` ademÃ¡s usa `pypdf`, tkinter y los diccionarios privados (`private/`, no versionados). Incluye `Dockerfile`.

## 3. programa_3 (planilla de gastos)

AplicaciÃ³n de escritorio (tkinter) que genera planillas de gastos mensuales basadas en las de un contador.
- Se ingresan los datos de boletas (`agregar_datos`, `actualizar_tabla`, `limpiar_campos`).
- Se elige el mes; `procesar_datos` y `armar_detalle` generan el Excel con formato (`borde_fila`, `combinar_etiqueta`, `celda_monto`).
- `guardar_data` / `recuperar_data` exportan y reimportan datos sin procesar.
- Su funcionalidad ya estÃ¡ integrada en `prog2` (ruta `/gastos`); esta versiÃ³n de escritorio se conserva como respaldo offline.
- Versiones: `Planilla_gastos_final.py` (principal), `Planilla_gastos_test.py` (pruebas), `Planilla gastos.py` (antigua).
- Ejecutable: `pyinstaller --onefile --windowed --add-data "icono;icono" --icon "./icono/logo.ico" Planilla_gastos_test.py` (ver `para buildear.txt`).

## 4. programa_4 (bitÃ¡cora de camiÃ³n)

App Flask (`app.py`, plantilla `templates/index.html`) para llenar la bitÃ¡cora: fecha, chofer, RUT, patente, ruta, horas, kilÃ³metros, observaciÃ³n y firma.
- Sin base de datos: los datos viven en el navegador; el servidor solo genera el Excel.
- `recorrido(ini, term)` calcula los km; `fecha_valida`, `numero`, `decodificar_firma` validan y procesan entradas.
- Rutas: `/` (inicio), exportar (`armar_excel`), importar (`leer_excel`, `imagenes_del_zip`) para continuar un folio, y apagar.
- Empaquetado de escritorio: `build.txt`. Dependencias: `requirements.txt`.
- La versiÃ³n web equivalente estÃ¡ en `prog2`.

## 5. programa_5 (cÃ³digos QR)

Genera un QR por material con stock de la bodega M501, para pegar en la bodega. Cada QR apunta a `<direcciÃ³n web>/<cÃ³digo del material>` (ruta `/:codigo` de prog2).
- `frontend_qr.py`: ventana para elegir Excel, carpeta destino, bodega y direcciÃ³n web, con barra de progreso.
- `frontend_qr_nuevos.py`: variante del frontend.
- `generarQR.py`: versiÃ³n simple por script (usa `openpyxl`, `qrcode`, tkinter).
- Salida en `QRmateriales/` (no versionada). Ejecutable: ver `build.txt`.

---

## Oportunidades de mejora detectadas
- Dividir `prog2/web/src/Admin.jsx` (~1900 lÃ­neas, mÃ¡s de 100 estados); plan en `prog2/SIGUIENTES_PASOS.md` (hooks por secciÃ³n y paneles `admin/Panel*.jsx`). Igual con `Detalle.jsx` y `App.jsx`.
- Resolver los avisos de ESLint (variables sin usar) y endurecer `no-unused-vars`.
- Configurar `trust proxy` en Express (hoy los lÃ­mites por IP dependen de ello detrÃ¡s de Cloudflare/Render).
- AÃ±adir tests de UI para `Navbar.jsx`, `Admin.jsx`, `Bitacora.jsx` y `App.jsx`.
- Los contadores de intentos de login y lÃ­mites de peticiones estÃ¡n en memoria: solo vÃ¡lidos con una instancia; usar almacenamiento compartido si se escala.
- `programa_1`, `programa_4` y `programa_5` duplican funciones ya presentes en `prog2`; decidir si se mantienen o se retiran.
- Mantener `DOCUMENTACION.md` sincronizado al agregar endpoints y pantallas (conteos de tests, rutas).

## Notas
- Los archivos con datos sensibles (`.env`, `.sesion-secreto`, `usuarios.json`, `private/`) no deben subirse al repositorio.
- Ver tambiÃ©n el `README.md` y el manual en `manual de uso/`.
