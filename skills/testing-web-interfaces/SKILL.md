---
name: testing-web-interfaces
description: Use when implementing frontend behavior, business rules, forms, navigation, data synchronization, responsive layouts, bug fixes, or preventing visual and functional regressions
---

# Pruebas de interfaces web

## Principio

Probar comportamiento observable y reglas del negocio. Una prueba debe fallar antes de la corrección por la causa que se pretende resolver.

## Capas

### Cálculos y reglas

Probar con entradas y resultados conocidos:

- totales, IVA, descuentos y saldos;
- costo promedio e inventario;
- utilidad y margen;
- caja y métodos de pago;
- reversión al editar, cancelar o eliminar.

### Contratos

Comprobar:

- scripts y estilos existentes;
- identificadores del DOM;
- recursos de `APP_SHELL`;
- rutas directas y dinámicas;
- APIs expuestas entre módulos;
- ausencia de claves privadas.

### Integración

Cubrir el flujo completo de clientes, proveedores, productos, pedidos, cotizaciones, compras, gastos, caja y respaldos.

### Navegador

Probar:

- navegación y búsqueda;
- apertura y cierre de modales;
- validación y envío de formularios;
- estados vacío, carga, error y sin conexión;
- permisos y controles deshabilitados;
- consola sin errores nuevos.

### Visual y responsive

Tomar capturas cuando cambie layout y verificar los viewports definidos en la skill responsive.

## Flujo para errores

1. Reproducir el síntoma.
2. Localizar la causa.
3. Escribir una prueba mínima que falle.
4. Aplicar la corrección.
5. Verificar la prueba específica.
6. Ejecutar `npm run test:contracts`.
7. Ejecutar `npm test`.

## Datos de prueba

- Usar identificadores únicos.
- No depender del orden de pruebas.
- Limpiar datos creados.
- No usar información real de clientes.
- Separar pruebas locales de `test:live`.

## Errores comunes

- Probar la implementación en lugar del comportamiento.
- Aceptar una prueba que pasa desde el inicio.
- Corregir expectativas para ocultar una regresión.
- Sustituir la suite por pruebas manuales.
- Ejecutar `test:live` contra producción sin aislamiento.
