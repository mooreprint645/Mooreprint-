# MoorePrint — Administración integral para imprenta

Aplicación web para controlar costos, pedidos, inventario, producción, clientes, proveedores, caja y resultados desde celular o computadora.

## Funciones principales

- **Resumen:** ventas, ganancia neta, caja, cuentas por cobrar, cuentas por pagar, inventario, metas y alertas.
- **Pedidos:** folio, cliente, responsable, prioridad, diseño, fechas, estados, costos internos, descuentos, IVA, pagos parciales y nota imprimible.
- **Cotizaciones:** vigencia, estados, impresión y conversión directa en pedido.
- **Clientes y proveedores:** contactos, historial de operaciones, ventas, compras y saldos.
- **Productos y costos:** materiales, mano de obra, diseño, energía, empaque, transporte, desperdicio, comisiones y margen.
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

- Configurar la URL del proyecto y la clave pública desde la propia página.
- Crear cuenta con correo y contraseña.
- Iniciar y cerrar sesión.
- Recuperar contraseña por correo.
- Bloquear la interfaz cuando Supabase está configurado y no existe una sesión.
- Sincronizar automáticamente las ventas.
- Eliminar en la nube los pedidos que ya no existen localmente.
- Consultar ventas por día, semana, mes y año.

### Activación

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor** y ejecuta completo `supabase/schema.sql`.
3. En MoorePrint entra a **Configuración → Supabase y acceso**.
4. Pega la URL del proyecto y la clave pública o `publishable key`.
5. Guarda la conexión y crea tu cuenta o inicia sesión.
6. En **Reportes → Ventas guardadas en Supabase**, elige Día, Semana, Mes o Año.

Nunca uses la clave `service_role` dentro de la página.

## Guardado local y nube

La aplicación sigue guardando todos los datos administrativos localmente. Cuando Supabase está conectado, las ventas también se sincronizan en la tabla `sales`.

Los diseños, imágenes, PDF y comprobantes adjuntos permanecen en `IndexedDB` del navegador y todavía no se envían a Supabase.

## Inventario automático

Cada producto puede tener una receta de materiales. Al mover un pedido a **Producción**, **Listo** o **Entregado**, el sistema descuenta existencias. Si el pedido se edita, cancela o elimina, las existencias se corrigen.

Las compras aumentan el inventario y actualizan el costo promedio. Las mermas descuentan material y registran la pérdida económica.

## Hacer privado el repositorio

En GitHub abre **Settings → General → Danger Zone → Change repository visibility → Make private**.

Antes de cambiarlo, confirma que el servicio de publicación admita repositorios privados. Si la página deja de estar publicada, se puede desplegar desde un servicio compatible con repositorios privados.

## Archivos principales

- `index.html`: estructura principal.
- `styles.css`, `brand-theme.css` y `advanced-features.css`: diseño e identidad visual.
- `manifest.webmanifest`, `sw.js`, `icon-192.png` e `icon-512.png`: aplicación PWA.
- `advanced-features.js`: producción, calendario, calculadora, QR, metas, alertas, historial y mermas.
- `advanced-fixes.js`: compatibilidad con respaldos y limpieza de datos.
- `files-db.js`: archivos adjuntos locales.
- `app-core.js`: datos, cálculos, inventario y caja.
- `app-render-main.js` y `app-render-finance.js`: vistas y reportes.
- `app-contacts.js`, `app-catalog.js`, `app-documents.js`, `app-finance.js` y `app-tools.js`: módulos administrativos.
- `supabase/schema.sql`: tabla, políticas RLS y función de reportes.
- `supabase-config.js`: configuración opcional incluida en código.
- `supabase-cloud.js`: configuración desde la interfaz, autenticación y sincronización.
- `app.js`: arranque de todos los módulos.
