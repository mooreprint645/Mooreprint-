---
name: optimizing-web-performance
description: Use when pages load slowly, large datasets or files are handled, startup queries grow, rendering blocks interaction, the PWA cache changes, or a feature adds scripts, styles, images, listeners, or network requests
---

# Rendimiento web

## Principio

Medir antes de optimizar. Reducir trabajo, datos y renderizado innecesarios sin sacrificar exactitud financiera ni sincronización.

## Revisar primero

- tiempo hasta que la interfaz responde;
- cantidad y tamaño de recursos;
- consultas iniciales a Supabase;
- filas cargadas y paginación;
- renders completos por operación;
- listeners duplicados;
- almacenamiento local e IndexedDB;
- tamaño y actualización de caché.

## Reglas para MoorePrint

- Paginar sin reemplazar colecciones completas por una sola página.
- Cargar primero datos necesarios para la pantalla actual.
- No recalcular todos los productos por cada pulsación si puede diferirse o limitarse.
- Mantener cálculos críticos deterministas; no usar resultados parciales como totales finales.
- Evitar múltiples renderizados globales por una sola operación.
- No registrar listeners nuevamente en cada render.
- Comprimir imágenes y limitar vistas previas de adjuntos.
- Mantener el shell inicial pequeño y separar recursos no críticos cuando sea seguro.

## PWA

- No almacenar respuestas sensibles en cachés públicas.
- Eliminar versiones antiguas controladamente.
- Verificar que una actualización no mezcle HTML nuevo con scripts antiguos.
- No aumentar la versión de caché como sustituto de corregir una estrategia defectuosa.

## Verificación

1. Registrar línea base reproducible.
2. Identificar cuello de botella con evidencia.
3. Aplicar un cambio aislado.
4. Comparar con la misma carga de datos.
5. Ejecutar pruebas funcionales y de contratos.
6. Verificar móvil de gama media y conexión lenta.

## Errores comunes

- Añadir debounce para ocultar un render global costoso.
- Reducir consultas perdiendo registros.
- Guardar copias duplicadas de grandes colecciones.
- Cargar todos los módulos “por si acaso”.
- Optimizar microfunciones mientras el problema real es red, DOM o volumen de datos.
