# Diseño: modo principiante administrativo

Fecha: 2026-07-13

## Problema

MoorePrint ya explica para qué sirve cada sección, pero una persona sin experiencia administrativa todavía necesita entender la relación entre módulos: qué dato está registrando, qué cambia al guardar, qué otras áreas reciben ese cambio y qué error puede provocar una captura incorrecta.

## Usuario principal

Propietario o administrador de una imprenta que conoce la operación física del negocio, pero tiene poca experiencia en administración, inventario, caja, costos y reportes.

## Objetivo

Hacer visible el efecto de cada acción sin obligar al usuario a aprender términos contables antes de trabajar.

## Solución

Agregar una capa independiente de modo principiante que complemente `learning-guide.js`:

1. Tarjeta de impacto en cada sección activa.
2. Mapa visual del flujo del negocio en Ayuda.
3. Panel “Al guardar pasará esto” dentro de formularios.
4. Explicación contextual del campo que recibe foco.
5. Etiquetas de impacto: clientes, ventas, producción, inventario, caja, utilidad y reportes.
6. Ejemplos sencillos con lenguaje de imprenta.
7. Activación predeterminada para perfiles nuevos, con opción de ocultarla.

## Modelo mental que debe enseñar

- Cliente y cotización preparan una venta.
- Pedido confirma el trabajo y puede crear saldo por cobrar.
- Producción puede consumir inventario.
- Compra aumenta inventario y puede crear saldo por pagar.
- Pago mueve caja y reduce un saldo.
- Gasto reduce utilidad y, cuando se paga, reduce caja.
- Reportes no crean datos; resumen lo capturado en otras secciones.

## Reglas de seguridad

- La capa no modifica datos administrativos.
- No intercepta ni reemplaza funciones de guardado.
- No cambia permisos ni políticas RLS.
- No calcula importes alternos.
- No afirma impactos que no correspondan al comportamiento actual.

## Interfaz

### Tarjeta por sección

Debe mostrar:

- “Aquí registras”.
- “Al guardar cambia”.
- “También se refleja en”.
- “Revisa antes de continuar”.
- Nivel de impacto: informativo, operativo o financiero.

### Formularios

Al abrir un formulario debe aparecer una caja superior con:

- resultado de guardar;
- áreas relacionadas;
- lo que no sucede automáticamente;
- comprobación mínima.

Al enfocar un campo debe mostrarse:

- significado sencillo;
- efecto del valor;
- advertencia concreta.

### Centro de aprendizaje

Debe incluir dos flujos:

1. Venta: Cliente → Cotización → Pedido → Producción → Cobro → Reportes.
2. Materiales: Proveedor → Compra → Inventario → Producto → Pedido.

Y una relación financiera: Gastos y pagos → Caja → Reportes.

## Accesibilidad y móvil

- Funcionar desde 360 px.
- Botones con texto y `aria-label`.
- No depender únicamente del color.
- Respetar `prefers-reduced-motion`.
- No bloquear formularios ni acciones principales.

## Verificación

- Recursos cargados estáticamente y agregados al `APP_SHELL`.
- Caché PWA incrementada.
- Cobertura de todas las secciones administrativas.
- Cobertura de los formularios principales.
- Prueba de explicación al enfocar campos.
- Suite Playwright completa.