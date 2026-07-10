# MoorePrint — Control de costos y pedidos

Aplicación web para administrar una imprenta desde computadora o teléfono.

## Funciones

- Catálogo de productos con precio de venta, materiales, mano de obra y otros costos.
- Cálculo automático del costo unitario, ganancia y margen.
- Pedidos con folio, cliente, teléfono, anticipo, fecha de entrega y estado.
- Notas de pedido listas para imprimir.
- Registro de gastos: materiales, pasajes, gasolina, gas, renta del local, servicios, mantenimiento y otros.
- Resumen de ventas, costos de producción, gastos, ganancia o pérdida y cobros pendientes.
- Reportes por rango de fechas y exportación a CSV.
- Respaldo e importación de datos en formato JSON.
- Diseño adaptable para celular, tableta y computadora.

## Cómo usar

1. En **Productos y costos**, registra cada producto de la imprenta. También puedes usar el botón **Cargar ejemplos**.
2. En **Pedidos**, crea una nota, selecciona productos y registra el anticipo.
3. En **Gastos**, anota pagos como pasajes, gas, gasolina, renta, servicios o compras.
4. Revisa la ganancia o pérdida en **Resumen** y **Reportes**.
5. Descarga respaldos periódicamente en **Configuración**.

## Guardado de información

Esta primera versión guarda los datos en el navegador mediante `localStorage`. Los datos permanecen en el dispositivo y navegador donde se capturaron. Para usarlos en otro dispositivo, descarga un respaldo JSON e impórtalo en el otro equipo.

## Publicar con GitHub Pages

1. Abre el repositorio en GitHub.
2. Entra a **Settings → Pages**.
3. En **Build and deployment**, selecciona **Deploy from a branch**.
4. Elige la rama `main`, carpeta `/ (root)` y guarda.
5. GitHub mostrará la dirección pública. Normalmente será:

`https://mooreprint645.github.io/Mooreprint-/`

## Archivos principales

- `index.html`: estructura de la aplicación.
- `styles.css`: diseño y adaptación a celular.
- `app.js`: pedidos, productos, gastos, cálculos, reportes y respaldos.
