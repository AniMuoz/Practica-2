# Diagrama de flujo - Programa Back (server.js)

```mermaid
flowchart TD
    A([Inicio: node server.js]) --> B[Cargar configuración y Supabase]
    B --> C[Iniciar Express<br/>cabeceras seguras + CORS + json]
    C --> D[Subir imágenes locales y precargar datos]
    D --> E[Escuchar peticiones<br/>desde Cloudflare Worker]
    E --> H0{¿Ruta?}
    H0 -- /healthz --> HZ[Responder ok]
    H0 -- /api --> RL{¿Supera el límite<br/>de peticiones?}
    RL -- Sí --> R429[Error 429]
    RL -- No --> AU{¿Sesión válida?<br/>/api/login es pública}
    AU -- No --> R401[Error 401]
    AU -- Sí --> H{Archivo en rutas/}
    H --> I[materiales.js<br/>tabla, CRUD, imagen, marcado, acceso]
    H --> J[planillas.js<br/>bodega, regional, inventario, stock]
    H --> K[reservas.js y ventas.js<br/>reservas, ventas, contratistas]
    H --> M[bitacora.js<br/>folios, filas, firma]
    I --> O[(Supabase)]
    J --> O
    K --> O
    M --> O
    J --> P{¿Excel?}
    P -- Sí --> Q[Generar archivo Excel]
    P -- No --> R[Responder JSON]
    O --> R
    I --> EV[Avisar cambios por /api/eventos<br/>a todos los usuarios]
    Q --> S([Respuesta al cliente])
    R --> S
    HZ --> S
    R429 --> S
    R401 --> S
    S --> T[Al redesplegar: cierre limpio]
```
