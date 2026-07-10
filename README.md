# MoorePrint — Administración integral para imprenta

Aplicación web local para controlar costos, pedidos, inventario, clientes, proveedores, caja y resultados de una imprenta desde celular o computadora.

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
- **Archivos de pedidos:** diseños, imágenes, PDF y comprobantes guardados localmente en IndexedDB.
- **Respaldo y exportación:** JSON para recuperar los datos y CSV para abrirlos en Excel.

## Inventario automático

Cada producto puede tener una receta con los materiales utilizados. Al cambiar un pedido a **En proceso**, **Listo** o **Entregado**, el sistema descuenta esos materiales. Si el pedido se modifica, cancela o elimina, las existencias se corrigen automáticamente.

Las compras aumentan las existencias y actualizan el costo promedio de cada material.

## Guardado local

Esta versión no utiliza cuentas ni base de datos en línea. La información administrativa se guarda en `localStorage` y los archivos adjuntos en `IndexedDB`.

- Los datos permanecen únicamente en el navegador y dispositivo donde fueron capturados.
- Es recomendable descargar respaldos JSON con frecuencia.
- El respaldo JSON incluye los registros administrativos, pero no los archivos adjuntos. Los archivos deben descargarse desde cada pedido.
- Para trabajar en otro dispositivo, importa allí el respaldo JSON.

## Publicar con GitHub Pages

1. Abre el repositorio en GitHub.
2. Entra a **Settings → Pages**.
3. En **Build and deployment**, selecciona **Deploy from a branch**.
4. Elige la rama `main`, carpeta `/ (root)` y guarda.
5. La dirección normalmente será:

`https://mooreprint645.github.io/Mooreprint-/`

## Archivos principales

- `index.html`: interfaz y módulos.
- `styles.css`: diseño adaptable.
- `files-db.js`: archivos adjuntos locales.
- `app-core.js`: datos, cálculos, inventario y caja.
- `app-render-main.js`: tablero, pedidos, clientes, productos e inventario.
- `app-render-finance.js`: compras, gastos, caja y reportes.
- `app-contacts.js`: clientes y proveedores.
- `app-catalog.js`: materiales, inventario y recetas.
- `app-documents.js`: pedidos y cotizaciones.
- `app-finance.js`: compras, pagos, gastos y recurrentes.
- `app-tools.js`: notas, exportaciones y respaldo.
- `app.js`: eventos e inicio de la aplicación.
