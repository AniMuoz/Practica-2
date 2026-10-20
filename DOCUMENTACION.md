# Documentación de Practica-2

Conjunto de programas hechos durante la práctica 2 (UNAB) para digitalizar el trabajo de inventario, gastos y bitácoras de una empresa.

| Carpeta | Programa | Tecnología |
|---|---|---|
| `programa_1` | Planillas de inventario (stock, bodega, reservas, ventas) | Python, Flask, openpyxl |
| `prog2` | Aplicación web compartida de inventario y bitácora | Node/Express + React/Vite, Supabase |
| `programa_3` | Planilla de gastos mensual | Python (escritorio), openpyxl |
| `programa_4` | Bitácora de camión | Python, Flask, Excel |
| `programa_5` | Generador de códigos QR por material | Python, tkinter, qrcode |

Otros archivos de la raíz: `docker-compose.yml` (levanta back y web), `.github/workflows/tests.yml` (CI), `Estructura_migracion.MD`, `manual de uso/` (manual para usuarios), `tutoriales.txt`.

---

## 1. prog2 (aplicación web)

### 1.1 Propósito
Marcar y revisar inventario de forma compartida y sin papel. Todos los usuarios ven los cambios al instante (eventos SSE).

Funciones:
- Ver, buscar y filtrar inventario por bodega, sub-ubicación, stock, precio y marcados.
- Editar materiales, marcarlos, subir fotos, QR y rombo.
- Importar Excel (SAP, precios, ubicaciones, reservas) y exportar planillas (stock, bodega, regional, inventario, stock detallado, reservas).
- Revisar reservas desde un PDF, registrar ventas, administrar contratistas.
- Bitácora de camión con folios, filas y firmas (con historial de firmas quitadas).
- Gestión de usuarios y roles (`admin`, `operador`, `desactivado`) y auditoría.

### 1.2 Arquitectura

```
Navegador ──> Cloudflare (Pages + Worker) ──/api──> Servidor Express (Render) ──> Supabase (BD + imágenes)
```

- **`prog2/web`**: interfaz React 19 + Vite + react-router. El Worker (`worker.js`, `functions/api/[[path]].js`) reenvía lo que empieza con `/api` al servidor.
- **`prog2/back`**: API Express que valida sesión, procesa datos, genera Excel (`exceljs`, `xlsx`), lee PDF (`pdf-parse`) y consulta Supabase.
- **Supabase**: tablas y bucket de imágenes.
- **`prog2/cloudflared/config.yml`**: configuración de túnel Cloudflare.

### 1.3 Servidor (`prog2/back`)

| Archivo | Función |
|---|---|
| `server.js` | Configuración Express, `/healthz`, imágenes, eventos SSE, registro de rutas, arranque y cierre limpio (SIGTERM/SIGINT). |
| `auth.js` | Login, logout, sesión (cookie, 7 días), cambio de clave, límite de fallos por IP (10) y por usuario (30). Rutas públicas: `/login`, `/logout`, `/sesion`, `/cambiar-clave`. |
| `seguridad.js` | CORS, cabeceras seguras, límite de peticiones por minuto, máximo de conexiones SSE. |
| `compartido.js` | Estado compartido: carpeta de imágenes, clientes SSE, colores. |
| `fuenteDatos.js`, `nucleoDatos.js` | Carga/precarga de datos, caché y lógica base de la tabla de materiales. |
| `planillasStock.js` | Construcción de planillas de stock, bodega, regional e inventario. |
| `reservasDatos.js` | Lectura y cruce de reservas (PDF/Excel). |
| `ventas.js`, `contratistas.js` | Ventas y contratistas. |
| `bitacora.js` | Folios, filas y firmas de la bitácora. |
| `importaciones.js` | Importación de Excel (SAP, precios, ubicaciones). |
| `supabase.js`, `supabaseTablas.js`, `supabaseTarea.js` | Cliente y acceso a tablas de Supabase. |
| `imagenesSupabase.js` | Subir, bajar y listar imágenes del bucket. |
| `crearBase.js`, `esquema.sql` | Creación del esquema de la base. |
| `crearUsuario.js` | Script CLI para crear usuarios. |
| `rutas/` | Rutas por tema: `materiales`, `planillas`, `reservas`, `ventas`, `bitacora`, `usuarios`. |
| `tests/` | Pruebas con `node --test`. |

#### Endpoints de la API (todos bajo `/api`, requieren sesión salvo los públicos)

**Sesión** (`auth.js`)
- `POST /login`, `POST /logout`, `GET /sesion`, `POST /cambiar-clave`

**Sistema** (`server.js`)
- `GET /healthz` (pública, sin prefijo `/api`)
- `GET /api/eventos` (SSE), `GET /api/imagenes/:nombre`, `GET /api/supabase` (estado de conexión)

**Materiales** (`rutas/materiales.js`)
- `GET /tabla`, `GET /tabla/ultimas-cargas`, `POST /tabla/excel` (importar), `POST /tabla/limpiar-inventario`
- `GET /buscar`
- `GET|POST /material`, `GET|PUT|DELETE /material/:codigo`
- `PUT /material/:codigo/marcado`, `PUT /material/:codigo/datos`
- `POST|DELETE /material/:codigo/imagen`
- `GET|POST /acceso` (clave para acciones delicadas)

**Planillas** (`rutas/planillas.js`) — cada una con variante `/excel`
- `GET /tabla/excel`, `/bodega`, `/regional`, `/inventario`, `/inventario-bodega`, `/stock-detallado`

**Reservas y ventas** (`rutas/reservas.js`, `rutas/ventas.js`)
- `GET /reservas`, `GET /reservas/excel`, `POST /reserva`, `POST /reserva/excel`
- `POST /ventas`, `GET|PUT /contratistas`

**Bitácora** (`rutas/bitacora.js`)
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
| `SESSION_SECRET` | Protege las sesiones (sin él se cierran al reiniciar). |
| Claves de Supabase | Conexión a BD e imágenes (ver `.env`, no se sube a git). |
| `ALLOWED_ORIGINS` | (opcional) Orígenes CORS adicionales. |
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
node crearUsuario.js <usuario> <contraseña> # crear usuario
```

### 1.4 Web (`prog2/web`)

Rutas de la interfaz (`src/main.jsx`):

| Ruta | Componente | Descripción |
|---|---|---|
| `/` | `App.jsx` | Tabla de inventario con filtros, paginación (100), marcado y descarga. |
| `/admin` | `Admin.jsx` | Panel: cargas de Excel, planillas, reservas, ventas, contratistas, bitácora. |
| `/personal` | `Personal.jsx` | Gestión de usuarios y cambio de clave. |
| `/auditoria` | `Auditoria.jsx` | Auditoría de la bitácora. |
| `/gastos` | `Gastos.jsx` | Planilla de gastos mensual (solo admin). Port web de `programa_3`: lógica en `back/gastos.js`, rutas `/api/gastos/*` en `back/rutas/gastos.js`; guarda/recupera datos sin procesar en xlsx (mismo formato de 5 columnas) y genera el detalle mensual. |
| `/qr` | `GeneradorQr.jsx` | Generador de QR (usa `generarQr.js`, `qrcode`, `jszip`). |
| `/:codigo` | `Detalle.jsx` | Ficha de un material. |

Otros: `Acceso.jsx` (login), `Navbar.jsx`, `Planilla.jsx`, `Bitacora.jsx`, `FiltrosTabla.jsx`, `ColoresPlanilla.jsx`, `Recorrido.jsx` (tutorial guiado), `reglasPlanilla.js` (filtros, colores y paginación puros), `admin/` (componentes `VistaPrevia`, `Interruptor`), estilos `admin.css` y `movil.css`.

Despliegue: `incrustar-api.js`/`api-build.js`/`aplicar-env.js` inyectan la URL de la API al build; `wrangler.toml|jsonc` configura Cloudflare; `public/_headers` define cabeceras.

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
Back: 16 archivos en `tests/`. Web: `tests/` (node) y `tests-ui/` (vitest + testing-library). GitHub Actions ejecuta lint, pruebas, cobertura y `npm audit`.

---

## 2. programa_1 (planillas de inventario, Flask)

Facilita que todos usen las mismas planillas. Interfaz web local (`templates/`: `front.html`, `tarjetas.html`, `ventas_form.html`, `diccionario_mod.html`) servida por `front_flask.py`, con lógica en `Berfre.py`.

Funciones (rutas de `front_flask.py`):
- **Stock**: vista previa y descarga (`stock_*`, `stock_det_*`).
- **Bodega** e **Inventario**: vista previa y descarga.
- **Reserva**: vista previa, descarga y reselección desde PDF.
- **Ventas**: formulario y procesamiento.
- **Diccionarios** (materiales, precios, ubicaciones): agregar, modificar, eliminar, exportar/importar Excel, importar archivos oficiales de precios/ubicaciones, recargar.
- **Tarjetas** de materiales, `apagar` y apertura automática del navegador.

Dependencias: `requirements.txt` (`flask`, `openpyxl`); `Berfre.py` además usa `pypdf`, tkinter y los diccionarios privados (`private/`, no versionados). Incluye `Dockerfile`.

## 3. programa_3 (planilla de gastos)

Aplicación de escritorio (tkinter) que genera planillas de gastos mensuales basadas en las de un contador.
- Se ingresan los datos de boletas (`agregar_datos`, `actualizar_tabla`, `limpiar_campos`).
- Se elige el mes; `procesar_datos` y `armar_detalle` generan el Excel con formato (`borde_fila`, `combinar_etiqueta`, `celda_monto`).
- `guardar_data` / `recuperar_data` exportan y reimportan datos sin procesar.
- Su funcionalidad ya está integrada en `prog2` (ruta `/gastos`); esta versión de escritorio se conserva como respaldo offline.
- Versiones: `Planilla_gastos_final.py` (principal), `Planilla_gastos_test.py` (pruebas), `Planilla gastos.py` (antigua).
- Ejecutable: `pyinstaller --onefile --windowed --add-data "icono;icono" --icon "./icono/logo.ico" Planilla_gastos_test.py` (ver `para buildear.txt`).

## 4. programa_4 (bitácora de camión)

App Flask (`app.py`, plantilla `templates/index.html`) para llenar la bitácora: fecha, chofer, RUT, patente, ruta, horas, kilómetros, observación y firma.
- Sin base de datos: los datos viven en el navegador; el servidor solo genera el Excel.
- `recorrido(ini, term)` calcula los km; `fecha_valida`, `numero`, `decodificar_firma` validan y procesan entradas.
- Rutas: `/` (inicio), exportar (`armar_excel`), importar (`leer_excel`, `imagenes_del_zip`) para continuar un folio, y apagar.
- Empaquetado de escritorio: `build.txt`. Dependencias: `requirements.txt`.
- La versión web equivalente está en `prog2`.

## 5. programa_5 (códigos QR)

Genera un QR por material con stock de la bodega M501, para pegar en la bodega. Cada QR apunta a `<dirección web>/<código del material>` (ruta `/:codigo` de prog2).
- `frontend_qr.py`: ventana para elegir Excel, carpeta destino, bodega y dirección web, con barra de progreso.
- `frontend_qr_nuevos.py`: variante del frontend.
- `generarQR.py`: versión simple por script (usa `openpyxl`, `qrcode`, tkinter).
- Salida en `QRmateriales/` (no versionada). Ejecutable: ver `build.txt`.

---

## Notas
- Los archivos con datos sensibles (`.env`, `.sesion-secreto`, `usuarios.json`, `private/`) no deben subirse al repositorio.
- Ver también el `README.md` y el manual en `manual de uso/`.
