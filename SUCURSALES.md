# MoorePrint — Sucursales, empleados y permisos

## Activación

Ejecuta en Supabase SQL Editor, en este orden:

1. `supabase/branches.sql`
2. `supabase/branches-security-fix.sql`

Después cierra y vuelve a abrir MoorePrint.

## Funcionamiento

- El propietario y los administradores pueden consultar todas las sucursales o seleccionar una.
- Encargados y empleados ven únicamente la sucursal asignada.
- Los pedidos se comparten en tiempo real entre los usuarios autorizados de la misma sucursal.
- Cada pedido registra sucursal, responsable y usuario que lo creó o actualizó.
- Los folios nuevos usan la clave de la sucursal, por ejemplo `CEN-0001`.
- Los datos locales se separan por cuenta para evitar que un empleado vea la información guardada por un administrador en el mismo dispositivo.
- Los costos internos se almacenan separados de los datos visibles del pedido.
- Los empleados sin permiso de costos no pueden consultar costos, recetas, utilidad ni reportes financieros.
- El catálogo público comparte únicamente nombre, categoría y precio de venta; nunca el costo interno.

## Roles

### Propietario

Acceso completo a todas las sucursales, empleados, permisos, costos, inventario, caja y reportes.

### Administrador

Acceso completo, excepto que no puede convertirse a sí mismo en propietario desde la aplicación.

### Encargado

Por defecto puede crear y actualizar pedidos, registrar pagos, consultar clientes, cotizaciones, producción, calendario e inventario de su sucursal. No ve costos ni utilidad salvo que el propietario active esos permisos.

### Empleado

Por defecto puede ver, crear y actualizar pedidos, además de consultar producción y calendario de su sucursal. No puede eliminar pedidos, registrar pagos, ver costos, proveedores, sueldos, caja o reportes.

## Crear un empleado

1. En Supabase abre `Authentication → Users → Add user`.
2. Crea el correo y la contraseña temporal; activa `Auto Confirm`.
3. En MoorePrint entra en `Configuración → Sucursales, empleados y permisos`.
4. Pulsa `+ Empleado`.
5. Escribe exactamente el mismo correo.
6. Selecciona sucursal, rol y permisos.
7. Guarda.

El empleado inicia sesión desde el mismo enlace público de MoorePrint.

## Crear otra sucursal

En `Configuración → Sucursales, empleados y permisos`, pulsa `+ Sucursal` y registra:

- Nombre, por ejemplo `Sucursal Centro`.
- Clave corta para folios, por ejemplo `CEN`.
- Dirección.

## Seguridad

La seguridad se aplica en Supabase mediante RLS. Ocultar botones en la página mejora la interfaz, pero la protección real está en las políticas de base de datos: un empleado no puede consultar otra sucursal ni leer la tabla financiera aunque intente llamar directamente a Supabase.
