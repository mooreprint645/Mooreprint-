---
name: maintaining-pwa-cache
description: Use when changing MoorePrint static resources, file paths, service worker behavior, manifest data, offline support, cache versions, installation, updates, or resources loaded by index.html
---

# Mantenimiento de PWA y caché

## Principio

Una PWA debe actualizarse como un conjunto compatible. HTML nuevo con JavaScript antiguo, o service worker nuevo con rutas inexistentes, puede dejar la aplicación inutilizable.

## Activadores

Usar esta skill cuando se modifique:

- `index.html` y sus recursos;
- nombres o rutas de scripts, estilos, iconos o imágenes;
- `sw.js`;
- `manifest.webmanifest`;
- carga dinámica;
- estrategia offline;
- instalación o actualización.

## Procedimiento

1. Enumerar recursos agregados, modificados, movidos y eliminados.
2. Comparar con referencias de `index.html`.
3. Comparar con `APP_SHELL`.
4. Revisar manifest e iconos.
5. Definir compatibilidad entre versión anterior y nueva.
6. Incrementar caché únicamente cuando el cambio lo requiere.
7. Ejecutar contratos y suite.
8. Probar instalación limpia.
9. Probar actualización desde una instalación anterior.
10. Probar offline y reconexión.

## Estrategia segura

- Eliminar cachés antiguas solo después de activar el nuevo worker.
- No almacenar respuestas autenticadas o sensibles en una caché compartida.
- Evitar cache-first para datos administrativos cambiantes.
- Mantener una página funcional si falla un recurso no crítico.
- Mostrar estado claro cuando la aplicación usa datos locales.

## Migración de rutas

Al mover un archivo actualizar en el mismo PR:

- HTML;
- service worker;
- loaders o referencias internas;
- pruebas;
- workflow de validación;
- documentación.

No dejar copias duplicadas indefinidamente. Si se necesita compatibilidad temporal, documentar fecha o criterio de eliminación.

## Prueba de actualización

1. Cargar la versión anterior y permitir que se instale.
2. Abrir y usar un flujo básico.
3. Publicar o servir la versión nueva.
4. Recargar y aceptar la actualización.
5. Confirmar que no quedan recursos mezclados.
6. Verificar datos locales y sesión.
7. Repetir sin conexión y después reconectar.

## Errores comunes

- Aumentar la versión sin revisar `APP_SHELL`.
- Mantener rutas eliminadas en caché.
- Probar solo una pestaña nueva sin service worker previo.
- Cachear datos de Supabase como archivos estáticos.
- Suponer que GitHub Pages invalida automáticamente la PWA instalada.
