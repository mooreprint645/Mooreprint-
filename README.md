# MoorePrint — Administración integral para imprenta

Aplicación web para controlar costos, pedidos, inventario, producción, clientes, proveedores, caja y resultados desde celular o computadora.

## Experiencia sencilla e intuitiva

La interfaz está organizada para que las tareas frecuentes sean fáciles de encontrar:

- Menú agrupado por **Trabajo diario, Ventas, Materiales y compras, Dinero y Sistema**.
- Panel **¿Qué necesitas hacer?** con accesos rápidos.
- Guía inicial con progreso para configurar el negocio.
- Búsqueda general de pedidos, clientes, cotizaciones, productos y materiales con `Ctrl + K`.
- Botón de ayuda que explica la pantalla actual.
- Menú inferior en celular con Inicio, Pedidos, Nuevo, Producción y Más.
- Formularios de pedidos y cotizaciones divididos en pasos.
- Opciones avanzadas de seguimiento ocultables para evitar formularios saturados.
- Tablas convertidas en tarjetas legibles en pantallas pequeñas.
- Botones con nombres y ayudas al pasar el cursor.
- Estados vacíos con una acción directa para crear el primer registro.
- Indicador de conexión local o nube.

## Catálogo de proveedores y costos automáticos

- Cada proveedor puede tener una lista estructurada de productos y materiales.
- Cada artículo guarda presentación, cantidad por paquete, precio, envío, otros cargos y costo final por unidad.
- Un artículo puede crear automáticamente un material de inventario o vincularse con uno existente.
- Es posible marcar un proveedor como costo principal para un material.
- El comparador muestra qué proveedor ofrece el costo unitario más bajo.
- Se conserva historial de cambios de precio.
- Los productos de MoorePrint pueden usar precio manual o precio automático.
- El precio automático toma materiales, mano de obra, diseño, energía, empaque, transporte, desperdicio y comisión.
- Al cambiar el costo de un material se recalculan los productos que tengan precio automático.
- Al seleccionar un producto en un pedido se colocan automáticamente precio, costo interno y receta de materiales.

## Funciones principales

- **Resumen:** ventas, ganancia neta, caja, cuentas por cobrar, cuentas por pagar, inventario, metas y alertas.
- **Pedidos:** folio, cliente, responsable, prioridad, diseño, fechas, estados, costos internos, descuentos, IVA, pagos parciales y nota imprimible.
- **Cotizaciones:** vigencia, estados, impresión y conversión directa en pedido.
- **Clientes y proveedores:** contactos, catálogo de precios, historial de operaciones, ventas, compras y saldos.
- **Productos y costos:** materiales, mano de obra, diseño, energía, empaque, transporte, desperdicio, comisiones, margen y precio automático.
- **Inventario y compras:** existencias, mínimos, costo promedio, entradas, salidas, consumo por pedidos y cuentas por pagar.
- **Gastos y caja:** gastos normales, recurrentes, cobros, pagos, retiros, aportaciones y corte diario.
- **Reportes:** ventas, costos, utilidad, flujo de caja, punto de equilibrio, tendencias, productos rentables y mejores clientes.

## Mejoras avanzadas incluidas

1. **Aplicación PWA instalable:** icono de MoorePrint, pantalla completa, caché y funcionamiento sin conexión.
2. **Tablero de producción:** columnas Pendiente, Diseño, Aprobación, Producción, Listo y Entregado; permite arrastrar pedidos entre etapas.
3. **Calendario:** muestra entregas, gastos por vencer y cobros pendientes.
4. **Calculadora rápida:** costo unitario, precio mínimo, precio recomendado, descuento, IVA, margen y ganancia total.
5. **Notas y cotizaciones MoorePrint:** identidad negra y amarilla, datos bancarios, WhatsApp, políticas, firmas y QR.
6. **Código QR por pedido:** contiene folio, cliente, estado, entrega, saldo, productos y notas.
7. **Control de diseños:** número de cambios, aprobación del cliente, fecha, responsable y notas de aprobación.
8. **Historial de actividad:** pedidos creados o editados, cambios de producción, cobros, pagos, cotizaciones, mermas y configuración.
9. **Centro de alertas:** entregas de hoy, atrasos, deudas, inventario bajo, gastos vencidos, márgenes bajos y respaldos pendientes.
10. **Comparación de ventas:** hoy contra ayer, semana contra semana, mes contra mes y año contra año.
11. **Metas mensuales:** ventas, ganancia y cantidad de pedidos con barras de avance.
12. **Control de mermas:** errores de impresión, roturas, pruebas, material defectuoso y devolución automática si se elimina el registro.

## Supabase e inicio de sesión

La integración permite:

- Bloquear la página hasta validar una sesión autorizada.
- Iniciar y cerrar sesión con usuarios creados desde Supabase.
- Recuperar contraseña por correo.
- Sincronizar automáticamente ventas.
- Sincronizar proveedores, precios, materiales, inventario y productos.
- Consultar ventas por día, semana, mes y año.

### Activación

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor** y ejecuta completo `supabase/schema.sql`.
3. Crea y autoriza el usuario administrador.
4. Ejecuta completo `supabase/catalog.sql` para activar proveedores, materiales, productos y precios.
5. Configura la URL y la `publishable key` en `supabase-config.js`.
6. Inicia sesión con el correo autorizado.

Nunca uses la clave `service_role` dentro de la página.

## Guardado local y nube

La aplicación guarda datos localmente para poder seguir funcionando sin conexión. Con Supabase conectado se sincronizan ventas, proveedores, catálogo de precios, materiales, existencias y productos.

Los diseños, imágenes, PDF y comprobantes adjuntos permanecen en `IndexedDB` del navegador y todavía no se envían a Supabase.

## Inventario automático

Cada producto puede tener una receta de materiales. Al mover un pedido a **Producción**, **Listo** o **Entregado**, el sistema descuenta existencias. Si el pedido se edita, cancela o elimina, las existencias se corrigen.

Las compras aumentan el inventario y actualizan el costo promedio. Las mermas descuentan material y registran la pérdida económica.

## Hacer privado el repositorio

En GitHub abre **Settings → General → Danger Zone → Change repository visibility → Make private**.

Antes de cambiarlo, confirma que el servicio de publicación admita repositorios privados. Si la página deja de estar publicada, se puede desplegar desde un servicio compatible con repositorios privados.

## Archivos principales

- `index.html`: estructura principal.
- `styles.css`, `brand-theme.css`, `advanced-features.css`, `supplier-catalog.css` y `usability.css`: diseño e identidad visual.
- `manifest.webmanifest`, `sw.js`, `icon-192.png` e `icon-512.png`: aplicación PWA.
- `supplier-catalog.js`: catálogo, comparación, historial de precios y precios automáticos.
- `catalog-cloud.js`: sincronización de proveedores, materiales, productos e inventario.
- `usability.js`: navegación guiada, búsqueda, formularios por pasos, accesos rápidos y experiencia móvil.
- `advanced-features.js`: producción, calendario, calculadora, QR, metas, alertas, historial y mermas.
- `advanced-fixes.js`: compatibilidad, normalización y carga de módulos.
- `files-db.js`: archivos adjuntos locales.
- `app-core.js`: datos, cálculos, inventario y caja.
- `app-render-main.js` y `app-render-finance.js`: vistas y reportes.
- `app-contacts.js`, `app-catalog.js`, `app-documents.js`, `app-finance.js` y `app-tools.js`: módulos administrativos.
- `supabase/schema.sql`: acceso privado, ventas, políticas RLS y reportes.
- `supabase/catalog.sql`: tablas y políticas del catálogo administrativo.
- `supabase-config.js`: URL y clave pública del proyecto.
- `supabase-cloud.js`: autenticación y sincronización de ventas.
- `app.js`: arranque de todos los módulos.
