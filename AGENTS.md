# AGENTS.md — MoorePrint

Estas instrucciones aplican a cualquier agente que trabaje en este repositorio.

## Propósito del proyecto

MoorePrint es una PWA administrativa para una imprenta. Controla pedidos, cotizaciones, clientes, proveedores, productos, costos, inventario, compras, gastos, caja, producción, archivos adjuntos y reportes.

La prioridad es proteger la información del negocio y mantener una experiencia clara en celular y computadora.

## Datos de marca

- Nombre: `MoorePrint`
- Giro: impresión, diseño y personalización de productos
- WhatsApp operativo: `722 503 8566`
- Identidad actual de la aplicación: negro, blanco y amarillo
- Idioma principal de la interfaz: español de México

No inventes teléfonos, cuentas bancarias, direcciones, políticas o datos fiscales. Usa solamente información ya confirmada en el repositorio o por el usuario.

## Arquitectura actual

El proyecto es una aplicación estática, sin bundler:

- `index.html`: shell y estructura principal.
- Archivos `*.js` en la raíz: dominio, interfaz, sincronización, compatibilidad y arranque.
- Archivos `*.css` en la raíz: estilos base y capas de corrección.
- `supabase/`: esquema SQL, políticas RLS y funciones de datos.
- `tests/`: pruebas Playwright y contratos del proyecto.
- `sw.js`, `manifest.webmanifest` e iconos: PWA y caché.
- `.github/workflows/validate.yml`: validación de CI.

Consulta `docs/architecture.md` antes de modificar módulos o rutas.

## Regla de estabilidad

No muevas archivos de producción solo para “ordenar” el repositorio dentro de una modificación funcional. Las rutas están conectadas con:

- `index.html`
- `sw.js`
- scripts dinámicos
- pruebas de contratos
- GitHub Actions
- caché instalada de la PWA

Cualquier migración de carpetas debe tener una especificación propia, plan, actualización de todas las referencias y prueba de actualización desde una versión previamente instalada.

## Jerarquía de trabajo

### Cambio pequeño y explícito

Ejemplos: corregir texto, cambiar una etiqueta, ajustar un botón o reparar un estilo localizado.

1. Confirma el archivo afectado.
2. Haz el cambio mínimo.
3. Ejecuta la verificación específica.
4. Ejecuta la puerta de calidad aplicable.

No abras una fase extensa de diseño cuando el usuario ya definió exactamente el resultado.

### Función nueva o rediseño

1. Usa `skills/planning-websites`.
2. Usa `skills/designing-web-interfaces` cuando haya interfaz.
3. Escribe una especificación en `docs/superpowers/specs/`.
4. Escribe el plan en `docs/superpowers/plans/`.
5. Implementa por tareas pequeñas.
6. Usa pruebas primero para comportamiento y regresiones.
7. Finaliza con `skills/web-quality-gate`.

### Error o comportamiento inesperado

1. Reproduce el problema.
2. Encuentra la causa raíz.
3. Agrega una prueba de regresión que falle por la causa correcta.
4. Aplica la corrección mínima.
5. Comprueba la función relacionada y la suite completa.

No acumules parches sin explicar qué origen corrigen.

## Reglas de interfaz

- La aplicación debe funcionar desde 360 px de ancho.
- No debe existir desplazamiento horizontal accidental.
- Las acciones principales deben seguir visibles y ser táctiles.
- Los formularios deben conservar etiquetas, mensajes de error y foco visible.
- No reemplaces elementos semánticos por `div` con eventos.
- No ocultes funciones críticas únicamente mediante hover.
- Mantén tablas utilizables como tarjetas o vistas compactas en celular.
- Respeta `prefers-reduced-motion` al agregar animaciones.
- Evita introducir otra capa de CSS tipo “fix” cuando el problema puede resolverse en la fuente original.

## Reglas de JavaScript

- Conserva JavaScript compatible con el navegador objetivo y sin depender de un proceso de compilación.
- Evita variables globales nuevas; usa el patrón modular existente.
- No dupliques lógica entre módulos.
- Separa cálculo de negocio, persistencia, sincronización y renderizado.
- Normaliza datos en los límites de entrada, no en múltiples vistas.
- Los cambios de inventario, caja y saldos requieren pruebas de regresión.
- No confíes en el orden accidental de carga: documenta dependencias entre scripts.

## Supabase y seguridad

- Nunca agregues una clave `service_role` al frontend, historial o documentación.
- La `publishable key` puede estar en el cliente; la autorización real debe depender de RLS.
- Toda tabla nueva necesita políticas RLS revisadas.
- Mantén aislamiento entre usuarios, sucursales y cuentas.
- No sincronices archivos adjuntos sin definir almacenamiento, límites, permisos y respaldo.
- Los cambios SQL deben ser repetibles o indicar claramente su orden de aplicación.
- No borres datos ni cambies políticas destructivas sin una migración explícita.

## PWA y caché

Cada cambio en recursos cargados por la aplicación debe revisar:

- `APP_SHELL` en `sw.js`
- versión de caché
- actualización de una instalación existente
- funcionamiento sin conexión
- rutas de iconos y manifest

No declares que un cambio está publicado mientras una caché antigua pueda seguir sirviendo archivos incompatibles.

## Pruebas y comandos

Instalación actual, mientras el repositorio no tenga `package-lock.json`:

```bash
npm install --no-audit --no-fund
```

Cuando se agregue y mantenga un lockfile válido, se debe migrar CI y documentación a `npm ci`.

Suite completa:

```bash
npm test
```

Contratos estructurales:

```bash
npm run test:contracts
```

Pruebas con Supabase real, únicamente cuando el entorno esté configurado:

```bash
npm run test:live
```

Para cada archivo JavaScript modificado:

```bash
node --check ruta/al/archivo.js
```

Antes de afirmar que el trabajo terminó, ejecuta pruebas recientes y reporta el resultado real. No sustituyas la suite con una inspección visual.

## Criterios de finalización

Un cambio no está terminado hasta comprobar, según aplique:

- comportamiento solicitado
- pruebas de regresión
- sintaxis JavaScript
- navegación por teclado
- móvil y escritorio
- consola sin errores nuevos
- sincronización local/nube
- PWA y caché
- permisos RLS
- documentación actualizada

## Commits y pull requests

- Una intención principal por commit.
- No mezcles reorganización masiva con una función del negocio.
- Explica impacto en datos, PWA, Supabase y compatibilidad.
- Incluye comandos ejecutados y resultados en el PR.
- Usa pull request en borrador para reorganizaciones o migraciones amplias.

## Skills del repositorio

Las skills locales viven en `skills/<nombre>/SKILL.md`. Antes de crear otra, verifica que el conocimiento no pertenezca mejor a este archivo, a documentación del proyecto o a una validación automática.
