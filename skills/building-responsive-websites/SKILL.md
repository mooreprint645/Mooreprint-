---
name: building-responsive-websites
description: Use when implementing or modifying interfaces that must work across phones, tablets, laptops, desktops, touch devices, orientation changes, or constrained viewport sizes
---

# Construcción responsive

## Principio

Diseñar desde el contenido crítico y la pantalla más limitada. Responsive no significa solamente reducir tamaños.

## Viewports mínimos

- 360 × 800
- 390 × 844
- 768 × 1024
- 1024 × 768
- 1440 × 900

Probar también orientación horizontal cuando existan formularios, tablas o modales.

## Reglas

- No permitir scroll horizontal accidental.
- Mantener objetivos táctiles cómodos y separados.
- Evitar alturas fijas para contenido variable.
- Usar tipografía y espacios que no dependan de un solo breakpoint.
- Permitir que barras de acciones se apilen sin ocultar botones.
- Convertir tablas extensas a tarjetas, scroll contenido o columnas priorizadas.
- Mantener modales dentro del viewport con encabezado y acciones accesibles.
- Verificar teclado virtual en formularios móviles.
- No ocultar información financiera esencial solo para “hacer que quepa”.

## Flujo de prueba

1. Abrir la pantalla sin datos.
2. Probar contenido corto y contenido largo.
3. Probar importes grandes, nombres largos y muchas filas.
4. Abrir menú, modal, selector y formulario.
5. Cambiar orientación.
6. Aumentar zoom del navegador.
7. Revisar foco y desplazamiento al mostrar errores.

## MoorePrint

Prioridad móvil:

1. estado y folio;
2. cliente y fecha de entrega;
3. total y saldo;
4. acción siguiente;
5. detalles secundarios.

El menú inferior móvil no debe tapar formularios, indicadores, toasts ni acciones fijas.

## Errores comunes

- Corregir cada pantalla con media queries aisladas.
- Usar `overflow-x: hidden` para ocultar un layout roto.
- Reducir texto hasta hacerlo ilegible.
- Dejar acciones destructivas junto a la acción principal en móvil.
- Probar únicamente el tamaño del dispositivo del desarrollador.
