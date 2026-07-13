---
name: deploying-websites
description: Use when publishing, updating, troubleshooting, or changing a site hosted on GitHub Pages, a PWA, a custom domain, Netlify, Vercel, or another production environment
---

# Despliegue de sitios web

## Principio

Publicar significa comprobar la versión servida, no solamente subir archivos. En una PWA también debe verificarse la transición desde cachés anteriores.

## MoorePrint en GitHub Pages

Antes de publicar:

1. Confirmar rama y alcance del cambio.
2. Ejecutar `npm run test:contracts`.
3. Ejecutar `npm test`.
4. Revisar recursos de `index.html`, manifest y `APP_SHELL`.
5. Confirmar que no existen secretos.
6. Verificar que las rutas relativas funcionan bajo `/Mooreprint-/`.

Después de publicar:

1. Abrir la URL pública en una sesión limpia.
2. Comprobar autenticación y carga inicial.
3. Revisar consola y red.
4. Crear un registro de prueba controlado y comprobar persistencia.
5. Probar recarga, modo sin conexión y reconexión.
6. Abrir una instalación antigua para validar actualización.

## Caché y rollback

- Identificar el commit publicado.
- Mantener un cambio reversible.
- Si HTML y scripts quedan incompatibles, revertir el conjunto completo.
- No corregir producción directamente con archivos sueltos fuera de Git.
- Documentar migraciones SQL que no puedan revertirse con el mismo commit.

## Variables y Supabase

- Usar únicamente configuración pública en el cliente.
- Confirmar que el dominio publicado está autorizado en autenticación.
- Revisar URLs de recuperación de contraseña y redirección.
- Aplicar SQL antes o después del despliegue según compatibilidad documentada.
- Evitar una versión de frontend que dependa de un esquema aún no aplicado.

## Evidencia de despliegue

Reportar:

- commit o PR;
- entorno y URL;
- comandos ejecutados;
- resultado de pruebas;
- versión de caché;
- migraciones aplicadas;
- riesgos conocidos y procedimiento de reversión.

## Errores comunes

- Probar solo el archivo local.
- Ignorar la ruta base de GitHub Pages.
- Cambiar el esquema y el frontend sin orden compatible.
- Asumir que actualizar `main` limpia la PWA inmediatamente.
- Declarar éxito sin abrir la versión pública.
