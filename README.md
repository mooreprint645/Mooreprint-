# MoorePrint — Administración integral para imprenta

Aplicación web para controlar costos, pedidos, inventario, clientes, proveedores, caja y resultados de una imprenta desde celular o computadora.

## Módulos incluidos

- **Resumen:** ventas, ganancia neta, saldo de caja, cuentas por cobrar, cuentas por pagar, inventario y alertas.
- **Pedidos:** folio, cliente, responsable, prioridad, diseño, fechas, estados, costos internos, descuentos, IVA, entrega, pagos parciales y nota imprimible.
- **Cotizaciones:** vigencia, estados, impresión y conversión directa en pedido.
- **Clientes:** teléfono, correo, RFC, dirección, notas, historial de pedidos, ventas y saldos.
- **Productos y costos:** recetas de materiales, mano de obra, diseño, electricidad o gas, empaque, transporte, trabajo externo, desperdicio, comisiones y margen.
- **Inventario:** existencias, mínimos, costo unitario, valor, alertas y movimientos.
- **Proveedores y compras:** contactos, materiales, facturas, costo promedio, pagos parciales y cuentas por pagar.
- **Gastos:** pasajes, gasolina, gas, renta, servicios, sueldos, mantenimiento, publicidad, impuestos y otros.
- **Gastos recurrentes:** generación mensual automática de renta, luz, internet, salarios y suscripciones.
- **Caja y pagos:** cobros, pagos, retiros, aportaciones, métodos de pago, referencias y corte diario.
- **Reportes:** ventas, costos, gastos, utilidad, flujo de caja, punto de equilibrio, tendencia mensual, productos rentables, mejores clientes e indicadores operativos.
- **Supabase:** sincronización de ventas y consultas agrupadas por día, semana, mes y año.
- **Archivos de pedidos:** diseños, imágenes, PDF y comprobantes guardados localmente en IndexedDB.
- **Respaldo y exportación:** JSON para recuperar los datos y CSV para abrirlos en Excel.

## Inventario automático

Cada producto puede tener una receta con los materiales utilizados. Al cambiar un pedido a **En proceso**, **Listo** o **Entregado**, el sistema descuenta esos materiales. Si el pedido se modifica, cancela o elimina, las existencias se corrigen automáticamente.

Las compras aumentan las existencias y actualizan el costo promedio de cada material.

## Guardado local y en la nube

La aplicación conserva el guardado local como respaldo inmediato. Cuando Supabase está configurado y el usuario inicia sesión, las ventas también se sincronizan automáticamente a la tabla `sales`.

Los archivos adjuntos continúan guardándose en `IndexedDB` del navegador y no se envían a Supabase en esta etapa.

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor** y ejecuta completo el archivo `supabase/schema.sql`.
3. En **Authentication → Users**, crea el usuario administrador con correo y contraseña.
4. Abre `supabase-config.js` y completa:

```js
window.MOOREPRINT_SUPABASE = {
  url: 'https://TU-PROYECTO.supabase.co',
  publishableKey: 'TU_CLAVE_PUBLICA'
};
```

5. No coloques la clave `service_role` en ningún archivo de la página.
6. En MoorePrint entra a **Configuración → Supabase y acceso** e inicia sesión.
7. En **Reportes → Ventas guardadas en Supabase**, selecciona Día, Semana, Mes o Año.

## Hacer privado el repositorio

En GitHub abre **Settings → General → Danger Zone → Change repository visibility → Make private**.

Antes de hacerlo, confirma que el servicio donde está publicada la página pueda desplegar repositorios privados. GitHub Pages desde repositorios privados requiere un plan compatible.

## Archivos principales

- `index.html`: interfaz y módulos.
- `styles.css` y `brand-theme.css`: diseño adaptable e identidad MoorePrint.
- `files-db.js`: archivos adjuntos locales.
- `app-core.js`: datos, cálculos, inventario y caja.
- `app-render-main.js`: tablero, pedidos, clientes, productos e inventario.
- `app-render-finance.js`: compras, gastos, caja y reportes.
- `app-contacts.js`: clientes y proveedores.
- `app-catalog.js`: materiales, inventario y recetas.
- `app-documents.js`: pedidos y cotizaciones.
- `app-finance.js`: compras, pagos, gastos y recurrentes.
- `app-tools.js`: notas, exportaciones y respaldo.
- `supabase/schema.sql`: tabla, políticas RLS y función de reportes.
- `supabase-config.js`: URL y clave pública del proyecto.
- `supabase-cloud.js`: inicio de sesión, sincronización y consultas por periodo.
- `app.js`: eventos e inicio de la aplicación.
