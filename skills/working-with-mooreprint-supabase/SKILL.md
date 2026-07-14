---
name: working-with-mooreprint-supabase
description: Use when modifying MoorePrint authentication, tables, RLS, SQL functions, synchronization, pagination, branch isolation, conflict handling, live tests, or local-to-cloud data flow
---

# Supabase en MoorePrint

## Principio

El frontend puede operar localmente, pero Supabase define identidad, autorización y sincronización. Cada cambio debe conservar datos completos, aislamiento y reintentos seguros.

## Antes de cambiar

1. Identificar tablas, funciones y políticas relacionadas.
2. Revisar `supabase/` completo y módulos `*-cloud.js`.
3. Determinar fuente de verdad para cada colección.
4. Documentar comportamiento local, conectado, sin conexión y reconectado.
5. Identificar compatibilidad con clientes que aún usan el esquema anterior.

## Consultas y paginación

- No reemplazar una colección completa con una sola página.
- Mantener cursor, orden y filtros deterministas.
- Evitar consultas sin límite al inicio.
- No ocultar registros nuevos con fechas calculadas en UTC cuando el negocio usa fecha local.
- Distinguir ausencia de datos, error, permiso denegado y sesión expirada.

## Escrituras

- Usar identificadores estables para reintentos.
- Prevenir duplicados por doble clic o reconexión.
- Aplicar transacciones o RPC cuando una operación modifica varias entidades dependientes.
- Resolver inventario, caja y pagos como una unidad consistente.
- No marcar sincronizado antes de confirmar la respuesta.

## RLS

Para cada tabla comprobar políticas separadas de `select`, `insert`, `update` y `delete`.

Verificar:

- usuario autenticado;
- pertenencia a organización o sucursal;
- rol y permiso específico;
- columnas que no debe poder cambiar;
- funciones `security definer` y `search_path`.

## Local y sesión

- Aislar claves locales por cuenta y contexto.
- Limpiar o cambiar el namespace al cerrar sesión.
- No heredar datos del usuario anterior en el mismo navegador.
- Conservar cola offline sin mezclar propietarios.

## Migraciones

- Escribir SQL repetible cuando sea posible.
- Indicar orden y dependencias.
- Evitar borrados destructivos sin respaldo.
- Mantener frontend compatible durante el despliegue gradual.
- Añadir prueba de contrato para tablas, columnas, funciones o políticas críticas.

## Verificación

- Pruebas locales y contratos.
- `npm run test:live` en entorno autorizado.
- Dos cuentas distintas.
- Dos sucursales cuando aplique.
- Paginación con más registros que el límite.
- Modo offline, reconexión y reintento.
- Cierre e inicio de sesión en el mismo navegador.
