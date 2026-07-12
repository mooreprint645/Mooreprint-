# Arquitectura de MoorePrint

## Objetivo

MoorePrint usa módulos pequeños con responsabilidades explícitas. El núcleo no debe sustituir funciones después de cargarlas ni depender del orden accidental de parches.

## Flujo principal

1. `index.html` carga estilos y scripts en un orden visible y estable.
2. `accounting-math.js` contiene fórmulas puras y comprobables.
3. `app-core.js` normaliza el estado y concentra inventario, caja y relaciones contables.
4. Los archivos `app-*.js` contienen formularios y renderizadores de cada área.
5. Los módulos especializados exponen una API bajo `window.MoorePrint...`.
6. `app.js` inicializa los módulos y registra los eventos de la interfaz.
7. Las integraciones con Supabase sincronizan el mismo estado sin redefinir las fórmulas.

## Motor contable

`accounting-math.js` es la única fuente para:

- totales de pedidos y cotizaciones;
- IVA y ventas netas;
- pagos, saldos y saldos a favor;
- compras y gastos;
- costo promedio de inventario;
- utilidad por producto;
- saldos por método de pago.

Las fórmulas no consultan el DOM ni Supabase. Esto permite probarlas con cantidades conocidas.

## Inventario

`app-core.js` controla:

- consumo por recetas de pedidos;
- devolución al editar o cancelar pedidos;
- entrada por compras;
- reversión de compras;
- costo promedio ponderado;
- movimientos y referencias de valorización.

Los formularios llaman estas funciones directamente. No existe una segunda implementación en módulos visuales.

## Productos y proveedores

`app-catalog.js` contiene el formulario de productos, el precio automático y la asignación de costos fijos.

`supplier-catalog.js` es un servicio explícito que ofrece:

- catálogo y comparación de proveedores;
- historial de precios;
- costo preferido de materiales;
- recálculo de productos automáticos;
- limpieza de datos al borrar un proveedor.

`app-contacts.js` y `app-render-main.js` llaman esa API sin sustituir sus propias funciones.

## Costos fijos

`monthly-overhead.js` solo administra los costos mensuales y expone cálculos de consulta. `app-core.js` incorpora el costo proporcional al calcular un producto. `app-finance.js` guarda la marca `includedInPricing` y los reportes la concilian.

## Avisos, ayuda y CFDI

`business-assistant.js` expone `init()` y `render()`. `app-render-main.js` lo llama explícitamente dentro del render general. El módulo no envuelve ni reemplaza `renderAll`.

## Carga de archivos

Los scripts están declarados directamente en `index.html`. No se crean etiquetas `<script>` en tiempo de ejecución. Esto permite ver dependencias, detectar archivos faltantes y usar la caché sin cargadores paralelos.

## Compatibilidad heredada

`select-innerhtml-stability.js` queda aislado como una protección temporal para selectores y paneles del flujo colaborativo antiguo. No carga módulos ni cambia fórmulas. Cuando los últimos paneles colaborativos se migren a componentes explícitos, este archivo podrá eliminarse.

Algunos módulos de sincronización colaborativa todavía interceptan operaciones para aplicar permisos, bloqueos y transacciones de Supabase. Esa capa está separada del núcleo contable y no contiene cálculos alternativos.

## Regla para nuevas funciones

Una función nueva debe:

1. agregar su lógica a un módulo responsable;
2. exportar una API explícita cuando otro módulo la necesite;
3. usar el motor contable en vez de repetir fórmulas;
4. registrarse directamente en `index.html` y `app.js`;
5. incluir pruebas de contrato y, cuando haya números, pruebas con resultados conocidos;
6. evitar `baseFunction`, `wrapFunction`, sustituciones de globales y cargadores dinámicos.
