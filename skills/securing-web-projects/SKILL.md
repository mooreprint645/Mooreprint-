---
name: securing-web-projects
description: Use when a web change handles authentication, Supabase, permissions, personal data, uploads, payments, environment configuration, API keys, destructive actions, or data shared between users or branches
---

# Seguridad de proyectos web

## Principio

La interfaz no es una frontera de seguridad. La autorización y el aislamiento de datos deben aplicarse en Supabase mediante RLS y funciones controladas.

## Secretos

- Nunca incluir `service_role`, contraseñas o tokens privados en frontend, commits, pruebas o capturas.
- Tratar la clave pública de Supabase como identificador público, no como autorización.
- No registrar sesiones completas ni datos sensibles en consola.

## Autorización

Para cada operación definir por separado:

- ver;
- crear;
- editar;
- eliminar;
- exportar;
- administrar permisos.

Ocultar un botón mejora la experiencia, pero no reemplaza una política RLS.

## Datos

- Aislar por usuario, organización o sucursal según el modelo vigente.
- Validar entradas en cliente y servidor.
- Evitar actualizaciones masivas sin filtro verificable.
- Confirmar acciones destructivas e indicar su alcance.
- Mantener respaldos antes de migraciones o borrados.
- No usar datos reales en pruebas automatizadas.

## Archivos

Antes de sincronizar adjuntos definir:

- tipos y tamaños permitidos;
- nombre seguro;
- propietario y permisos;
- retención y borrado;
- cuota y costos;
- respaldo y recuperación.

## Supabase

- Toda tabla nueva necesita RLS habilitado y políticas mínimas.
- Las funciones `security definer` requieren revisión explícita de `search_path` y permisos.
- El SQL debe indicar dependencias y orden de aplicación.
- Los errores mostrados al usuario no deben exponer consultas, nombres internos o tokens.

## Lista de revisión

- ¿Otro usuario puede leer o modificar este registro?
- ¿Una sucursal puede ver datos de otra?
- ¿Una solicitud manipulada omite restricciones del frontend?
- ¿El modo sin conexión conserva datos de una sesión anterior?
- ¿Cerrar sesión limpia estado y cachés sensibles?
- ¿La exportación contiene más información de la necesaria?

## Errores comunes

- Confiar en `user_metadata` editable para permisos críticos.
- Crear políticas demasiado amplias durante pruebas y dejarlas activas.
- Compartir un almacenamiento local entre cuentas del mismo navegador.
- Mostrar mensajes técnicos completos de Supabase.
