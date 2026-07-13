---
name: web-quality-gate
description: Use before claiming that a website, PWA, interface feature, bug fix, refactor, Supabase change, responsive adjustment, or deployment is complete
---

# Puerta de calidad web

## Regla

No declarar éxito sin evidencia reciente. Ejecutar las verificaciones aplicables después del último cambio.

## Verificación base

```bash
npm ci
npm run test:contracts
npm test
```

Para cada JavaScript modificado:

```bash
node --check ruta/al/archivo.js
```

`npm run test:live` solo se ejecuta con entorno Supabase aislado y autorizado.

## Requisitos funcionales

- Releer la petición y la especificación.
- Comprobar cada criterio de aceptación.
- Probar el flujo normal y al menos un error relevante.
- Verificar que no se duplican registros al repetir una acción.
- Revisar inventario, caja, saldos y reportes cuando el cambio los afecte.

## Interfaz

- Probar 360 × 800, 390 × 844, tablet y escritorio.
- Revisar teclado, foco y modales.
- Confirmar que no existe scroll horizontal accidental.
- Probar contenido largo, importes grandes y estados vacíos.
- Revisar consola sin errores nuevos.

## Datos y Supabase

- Confirmar aislamiento entre cuentas y sucursales.
- Revisar RLS y permisos de cada operación.
- Confirmar cierre de sesión y limpieza de estado local.
- Verificar comportamiento offline, reconexión y conflictos.
- Confirmar que no se incluyeron secretos.

## PWA

Cuando cambien recursos o rutas:

- validar manifest;
- validar `APP_SHELL`;
- revisar versión de caché;
- probar instalación limpia;
- probar actualización desde versión previa;
- probar modo sin conexión.

## Reporte final

Indicar con precisión:

- archivos o áreas modificadas;
- comandos ejecutados;
- número de pruebas aprobadas o fallidas;
- comprobaciones manuales realizadas;
- limitaciones o verificaciones no ejecutadas;
- impacto en despliegue o migraciones.

## Bloqueos

No declarar terminado cuando:

- una prueba falla;
- no se pudo abrir el flujo afectado;
- existe un error de consola relacionado;
- la migración SQL no se probó;
- la versión pública no se verificó después del despliegue;
- solamente se revisó el código visualmente.
