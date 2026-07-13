# Skills locales de MoorePrint

Estas skills complementan la metodología general de desarrollo con reglas específicas para aplicaciones web y para la arquitectura de MoorePrint.

## Flujo recomendado

### Función o rediseño

1. `planning-websites`
2. `designing-web-interfaces`
3. `building-responsive-websites`
4. `building-accessible-websites`
5. `testing-web-interfaces`
6. `web-quality-gate`

### Supabase

- `working-with-mooreprint-supabase`
- `securing-web-projects`
- `testing-web-interfaces`
- `web-quality-gate`

### Recursos, rutas o instalación

- `maintaining-pwa-cache`
- `deploying-websites`
- `web-quality-gate`

### Página pública

- `planning-websites`
- `designing-web-interfaces`
- `building-responsive-websites`
- `building-accessible-websites`
- `optimizing-web-seo`
- `optimizing-web-performance`
- `deploying-websites`

## Catálogo

- `planning-websites`: alcance, flujos, datos y criterios de éxito.
- `designing-web-interfaces`: jerarquía, formularios y componentes administrativos.
- `building-responsive-websites`: móvil, tablet y escritorio.
- `building-accessible-websites`: semántica, teclado, foco y mensajes.
- `testing-web-interfaces`: pruebas de dominio, contratos, integración y navegador.
- `securing-web-projects`: secretos, permisos, datos y archivos.
- `optimizing-web-performance`: consultas, renderizado, recursos y volumen.
- `optimizing-web-seo`: páginas públicas y posicionamiento local.
- `deploying-websites`: publicación, GitHub Pages y rollback.
- `web-quality-gate`: evidencia obligatoria antes de terminar.
- `working-with-mooreprint-supabase`: sincronización, RLS y migraciones.
- `maintaining-pwa-cache`: service worker, manifest y actualización.

## Creación de nuevas skills

Crear una skill únicamente cuando:

- el criterio sea reutilizable;
- requiera juicio y no pueda automatizarse fácilmente;
- no pertenezca a `AGENTS.md`;
- no sea una convención de un solo archivo;
- exista una situación concreta que permita comprobar que mejora el comportamiento del agente.

Cada skill debe tener `name`, `description` y un nombre de carpeta igual al campo `name`.
