# Contribuir a MoorePrint

## Antes de modificar

1. Lee `AGENTS.md`.
2. Consulta `docs/architecture.md`.
3. Identifica si el cambio es pequeño, una función, una reorganización o una corrección.
4. No mezcles tipos de cambio en el mismo pull request.

## Preparación

```bash
npm ci
npm test
```

La suite debe pasar antes de empezar. Si falla en `main`, documenta el fallo de línea base antes de continuar.

## Ramas

Usa nombres descriptivos:

```text
feat/nombre-corto
fix/nombre-corto
refactor/nombre-corto
docs/nombre-corto
```

Las reorganizaciones amplias se trabajan en una rama exclusiva y mediante PR en borrador.

## Desarrollo

### Funciones y errores

- Escribe o ajusta primero la prueba que describe el comportamiento esperado.
- Comprueba que falla por la razón correcta.
- Implementa el cambio mínimo.
- Ejecuta la prueba específica y después la suite completa.

### Interfaz

Comprueba como mínimo:

- 360 × 800
- 390 × 844
- 768 × 1024
- 1024 × 768
- 1440 × 900

Revisa foco, teclado, errores de consola, desbordamiento horizontal, modales, formularios y tablas.

### Supabase

- No incluyas `service_role`.
- Revisa RLS en tablas nuevas o modificadas.
- Documenta el orden de ejecución del SQL.
- Comprueba aislamiento entre usuarios y sucursales.

### PWA

Cuando cambien rutas o recursos:

- actualiza `APP_SHELL`;
- revisa la versión de caché;
- prueba instalación limpia;
- prueba actualización desde una versión previa;
- prueba funcionamiento sin conexión.

## Verificación

```bash
npm run test:contracts
npm test
```

Para JavaScript modificado:

```bash
node --check archivo.js
```

`npm run test:live` se ejecuta únicamente con un entorno Supabase autorizado.

## Pull request

El PR debe explicar:

- qué cambió;
- por qué;
- impacto en datos, inventario, caja o saldos;
- impacto en Supabase y RLS;
- impacto en PWA y caché;
- pruebas ejecutadas y resultados;
- capturas cuando exista cambio visual.

No declares terminado un cambio sin evidencia reciente de las verificaciones aplicables.
