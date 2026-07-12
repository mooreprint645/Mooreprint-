# Supabase de MoorePrint

La base instalada actualmente se reproduce en este orden:

1. Ejecutar los archivos base indicados por sus encabezados (`schema.sql`, `catalog.sql`, `monthly-costs.sql`, `branches.sql`, `team-workflow.sql`, `team-improvements.sql` y `team-operations.sql`).
2. Ejecutar `team-hardening.sql`.
3. Ejecutar `team-hardening-production.sql`.

`team-hardening-production.sql` es la copia canónica de los bloques compactos que se aplicaron desde el editor móvil de Supabase. Reemplaza las funciones de transacciones, restauración, bloqueos, historial y autodiagnóstico por la misma versión que está activa en producción.

Definir esas funciones no restaura ni elimina datos. La eliminación de registros solo ocurre cuando el propietario invoca expresamente `restore_team_backup` desde MoorePrint y confirma escribiendo `RESTAURAR`.
