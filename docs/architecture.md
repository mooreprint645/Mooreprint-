# Arquitectura de MoorePrint

## Objetivo

MoorePrint es una PWA administrativa estática con persistencia local, sincronización parcial con Supabase y pruebas Playwright. Los módulos deben tener responsabilidades explícitas: el núcleo no debe sustituir funciones después de cargarlas ni depender del orden accidental de parches.

GitHub Pages sirve directamente los archivos del repositorio. Por eso las rutas, el orden de scripts y la caché del service worker forman parte del contrato de producción.

## Flujo principal

1. `index.html` carga estilos y scripts en un orden visible y estable.
2. `accounting-math.js` contiene fórmulas puras y comprobables.
3. `app-core.js` normaliza el estado y concentra inventario, caja y relaciones contables.
4. Los archivos `app-*.js` contienen formularios y renderizadores de cada área.
5. Los módulos especializados exponen una API bajo `window.MoorePrint...`.
6. `app.js` inicializa los módulos y registra eventos.
7. Las integraciones con Supabase sincronizan el mismo estado sin redefinir fórmulas.
8. `sw.js` mantiene el shell disponible y controla la actualización de recursos.

## Mapa de responsabilidades

### Shell y PWA

- `index.html`: navegación, secciones, modales y orden de carga.
- `app.js`: arranque final.
- `pwa.js`: instalación y registro PWA.
- `manifest.webmanifest`: metadatos instalables.
- `sw.js`: precarga y estrategia de caché.

### Núcleo del negocio

- `accounting-math.js`: cálculos contables puros.
- `app-core.js`: estado, inventario, caja y relaciones centrales.
- `state-bridge.js`: puente entre el estado principal y módulos posteriores.
- `files-db.js`: adjuntos en IndexedDB.
- `local-protection.js`: aislamiento y protección local.

### Interfaz administrativa

- `app-render-main.js`: vistas operativas.
- `app-render-finance.js`: vistas financieras y reportes.
- `app-contacts.js`: clientes y proveedores.
- `app-catalog.js`: productos, materiales y costos.
- `app-documents.js`: pedidos, cotizaciones y documentos.
- `app-finance.js`: caja, gastos, compras y pagos.
- `app-tools.js`: respaldos, exportaciones y herramientas.

### Capacidades especializadas

- `advanced-features.js`: producción, calendario, QR, metas y alertas.
- `supplier-catalog.js`: catálogo de proveedores y comparación de costos.
- `monthly-overhead.js`: gastos indirectos mensuales.
- `business-assistant.js`: asistencia operativa.
- `branch-access.js`: contexto y acceso por sucursal.
- `team-*.js`: colaboración, operaciones y endurecimiento.

### Nube y sincronización

- `supabase-config.js`: configuración pública del cliente.
- `supabase-cloud.js`: autenticación y sincronización base.
- `catalog-cloud.js`: catálogo e inventario.
- `overhead-cloud.js`: gastos indirectos.
- `granular-sync-guard.js`: protección granular de sincronización.
- `startup-query-limit.js`: límites de carga inicial.
- `supabase/`: esquema SQL, RLS y funciones.

### Compatibilidad y correcciones

- `advanced-fixes.js`
- `performance-fixes.js`
- `select-innerhtml-stability.js`
- `team-operations-ui-guard.js`
- `mobile-fixes.js` y estilos correctivos

Estos archivos son capas temporales o defensivas. Una corrección nueva debe aplicarse en el módulo responsable siempre que sea posible, acompañada de una prueba de regresión.

## Motor contable

`accounting-math.js` es la fuente única para:

- totales de pedidos y cotizaciones;
- IVA y ventas netas;
- pagos, saldos y saldos a favor;
- compras y gastos;
- costo promedio de inventario;
- utilidad por producto;
- saldos por método de pago.

Las fórmulas no consultan DOM ni Supabase. Esto permite probarlas con cantidades conocidas.

## Inventario

`app-core.js` controla:

- consumo por recetas de pedidos;
- devolución al editar o cancelar pedidos;
- entrada por compras;
- reversión de compras;
- costo promedio ponderado;
- movimientos y referencias de valorización.

Los formularios llaman estas funciones directamente. No debe existir una segunda implementación en módulos visuales.

## Productos, proveedores y costos fijos

`app-catalog.js` contiene el formulario de productos, el precio automático y la asignación de costos fijos.

`supplier-catalog.js` ofrece una API explícita para catálogo, comparación, historial de precios, costo preferido, recálculo automático y limpieza al borrar proveedores.

`monthly-overhead.js` administra costos mensuales. `app-core.js` incorpora el costo proporcional al calcular un producto y `app-finance.js` concilia su registro.

## Límites arquitectónicos

1. **Dominio:** reglas y cálculos no dependen del DOM.
2. **Persistencia:** local y Supabase se exponen mediante funciones claras.
3. **Interfaz:** renderiza estado; no recalcula reglas financieras.
4. **Sincronización:** debe ser idempotente, paginada y aislada por cuenta o sucursal.
5. **Compatibilidad:** todo parche temporal necesita comentario, prueba y criterio de retiro.
6. **PWA:** cada ruta estática forma parte del contrato de actualización.
7. **Seguridad:** la autorización depende de RLS, nunca de ocultar controles en el cliente.

## Carga de archivos

Los scripts están declarados directamente en `index.html`. No se crean etiquetas `<script>` en tiempo de ejecución. Esto permite ver dependencias, detectar archivos faltantes y usar la caché sin cargadores paralelos.

`select-innerhtml-stability.js` permanece aislado como protección temporal. Algunos módulos colaborativos todavía interceptan operaciones para permisos, bloqueos y transacciones, pero no deben contener cálculos alternativos.

## Estructura objetivo gradual

```text
/
├── index.html
├── manifest.webmanifest
├── sw.js
├── assets/
│   ├── icons/
│   └── images/
├── src/
│   ├── core/
│   ├── data/
│   ├── cloud/
│   ├── modules/
│   ├── ui/
│   ├── compatibility/
│   └── styles/
├── supabase/
├── tests/
├── skills/
├── docs/
└── .github/
```

Esta estructura no se creará de una sola vez. MoorePrint seguirá funcionando sin bundler mientras cada migración demuestre que conserva GitHub Pages, PWA y pruebas.

## Plan de organización

### Fase 1 — Reglas y documentación

- `AGENTS.md`, skills locales, arquitectura y plantillas.
- Sin cambios de comportamiento.

### Fase 2 — Recursos

- Mover iconos e imágenes a `assets/`.
- Actualizar HTML, manifest, service worker y pruebas.

### Fase 3 — Estilos

- Agrupar base, componentes, vistas y compatibilidad.
- Conservar el orden de cascada explícito.
- Reducir archivos de parches corrigiendo la fuente.

### Fase 4 — JavaScript

- Mover un dominio por pull request.
- Actualizar todas las rutas estáticas y dinámicas.
- Evitar cambios funcionales durante el traslado.

### Fase 5 — Contratos

- Reducir globals.
- Documentar interfaces consumidas y producidas.
- Extraer cálculos puros y adaptadores de datos.

### Fase 6 — Herramientas

Solo entonces se evaluará un bundler o framework. No se agregará React, Vue, Vite u otra herramienta solo para “modernizar”.

## Regla para nuevas funciones

Una función nueva debe:

1. agregar lógica al módulo responsable;
2. exportar una API explícita si otro módulo la necesita;
3. usar el motor contable en lugar de repetir fórmulas;
4. registrarse directamente en `index.html` y `app.js`;
5. incluir pruebas de contrato y resultados conocidos cuando haya números;
6. evitar sustituciones de globals, wrappers y cargadores dinámicos;
7. documentar impacto en PWA, datos y permisos.

## Lista al mover un archivo

- [ ] Actualizar `index.html`.
- [ ] Actualizar referencias dinámicas.
- [ ] Actualizar `APP_SHELL` en `sw.js`.
- [ ] Revisar la versión de caché.
- [ ] Actualizar pruebas con rutas directas.
- [ ] Actualizar `.github/workflows/validate.yml`.
- [ ] Actualizar documentación.
- [ ] Ejecutar `npm test`.
- [ ] Probar instalación limpia.
- [ ] Probar actualización desde caché anterior.
