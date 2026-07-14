# Guía de aprendizaje para usuarios nuevos

## Objetivo

Hacer que una persona que empieza a administrar MoorePrint o un usuario operativo nuevo comprenda para qué sirve cada sección, qué información modifica y cuál es la siguiente tarea recomendada.

## Usuarios

### Administrador

Configura el negocio, catálogo, inventario, proveedores, usuarios, respaldos, caja y reportes.

### Usuario operativo

Registra clientes, pedidos, entregas, cambios de producción y cobros según sus permisos.

## Alcance

- Bienvenida inicial mostrada una vez por cuenta o perfil local.
- Elección entre ruta de Administrador y Usuario operativo.
- Progreso guardado por cuenta en `localStorage`.
- Panel de aprendizaje en el Resumen.
- Explicación contextual dentro de cada sección mientras el modo aprendizaje esté activo.
- Modal de ayuda ampliada para cada sección.
- Centro de ayuda con rutas, glosario y opción para reiniciar la guía.
- Diseño responsive y accesible.

## Fuera de alcance

- Cambiar reglas contables, inventario, caja o sincronización.
- Crear permisos nuevos.
- Guardar progreso de aprendizaje en Supabase.
- Reorganizar módulos existentes.

## Flujo principal

1. MoorePrint detecta que el perfil no ha elegido una ruta.
2. Muestra una bienvenida con dos opciones.
3. El usuario elige Administrador o Usuario operativo.
4. El Resumen muestra la siguiente tarea recomendada y el avance.
5. Al entrar a una sección aparece una explicación breve: propósito, cuándo usarla y qué cambia.
6. El botón Guía abre instrucciones completas de la sección.
7. El Centro de ayuda permite cambiar ruta, consultar términos y reiniciar el recorrido.

## Progreso

El progreso combina acciones observables del estado con secciones visitadas:

- Administrador: datos del negocio, catálogo o materiales, proveedor o compra, revisión financiera y respaldo.
- Operativo: cliente, pedido, producción, cobro y calendario.

Las claves deben incluir `user_id` cuando `MoorePrintBranches.getProfile()` esté disponible. En modo local se utiliza un perfil `local`.

## Estados

- Primera visita sin ruta.
- Ruta seleccionada con progreso parcial.
- Ruta completada.
- Modo aprendizaje pausado.
- Sección sin permiso: no debe convertirse en paso obligatorio visible para el usuario.
- Sin conexión: la guía sigue funcionando porque solo usa datos locales.

## Interfaz

- Botón superior con texto `Guía`, no solo un signo de interrogación.
- Panel de aprendizaje debajo de los accesos rápidos.
- Tarjeta contextual compacta al inicio de cada sección.
- Modal con propósito, uso, impacto, pasos, prevención de errores y siguiente acción.
- En móvil, tarjetas de una columna y acciones de ancho completo.

## Accesibilidad

- Botones con texto explícito.
- Estado de progreso acompañado por texto, no solo color.
- Controles con foco visible.
- Diálogos con títulos y etiquetas accesibles mediante el sistema existente.
- La guía contextual puede cerrarse y volver a abrirse.

## Seguridad y datos

- No se guarda información del negocio en las claves de aprendizaje.
- No se modifican permisos ni políticas RLS.
- El progreso no debe mezclarse entre usuarios del mismo navegador.

## PWA

Se agregan `learning-guide.js` y `learning-guide.css`. Deben declararse en `index.html`, `APP_SHELL` y contratos. Se incrementa la versión de caché.

## Criterios de aceptación

- Un perfil nuevo recibe una bienvenida clara.
- Puede elegir una de las dos rutas.
- El progreso queda aislado por perfil.
- Cada sección principal tiene una explicación contextual.
- El botón Guía abre ayuda específica de la sección.
- El Centro de ayuda permite cambiar o reiniciar la ruta.
- La interfaz funciona desde 360 px.
- Todas las pruebas y contratos pasan.
