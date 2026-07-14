# Plan de implementación — Guía de aprendizaje

## 1. Contratos de prueba

Crear `tests/learning-guide.spec.js`.

Comprobar primero que:

- `index.html` y `sw.js` declaran `learning-guide.css` y `learning-guide.js`.
- existen rutas `administrator` y `operator`;
- el almacenamiento utiliza el `user_id` del perfil;
- hay ayuda para todas las secciones principales;
- existe bienvenida, cambio de ruta, pausa y reinicio;
- `usability.js` delega el botón Guía al módulo;
- la versión de caché es posterior a `v40`.

Resultado inicial esperado: las pruebas fallan porque los archivos y contratos todavía no existen.

## 2. Módulo de aprendizaje

Crear `learning-guide.js` con:

- metadatos ampliados por sección;
- dos rutas de aprendizaje;
- almacenamiento aislado por perfil;
- detección de progreso mediante `state`;
- bienvenida inicial;
- panel de aprendizaje;
- tarjeta contextual de sección;
- ayuda completa de sección;
- integración con el Centro de ayuda;
- API `window.MoorePrintLearningGuide`.

## 3. Estilos

Crear `learning-guide.css` con:

- selector de ruta;
- barra y lista de progreso;
- tarjeta contextual;
- modal de ayuda;
- glosario;
- reglas responsive desde 360 px;
- estilos de foco y movimiento reducido.

## 4. Integración

Actualizar `index.html`:

- cargar `learning-guide.css` después de `usability.css`;
- cargar `learning-guide.js` después de `business-assistant.js` y antes de `app.js`.

Actualizar `usability.js`:

- mostrar `Guía` como texto visible;
- delegar la ayuda al módulo cuando esté disponible;
- notificar cambios de sección al módulo.

Actualizar `business-assistant.js`:

- presentar la sección Ayuda como Centro de aprendizaje;
- dejar un contenedor para las rutas y el glosario.

## 5. PWA

Actualizar `sw.js`:

- agregar ambos recursos a `APP_SHELL`;
- incrementar `CACHE_NAME` de `v40` a `v41`.

## 6. Verificación

Ejecutar en CI:

- sintaxis JavaScript;
- `npm run test:skills`;
- `npm run test:contracts`;
- `npm test`.

Revisar que no se modificaron reglas del negocio, Supabase ni permisos.
