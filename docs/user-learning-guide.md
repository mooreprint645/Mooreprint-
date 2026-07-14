# Guía de aprendizaje de MoorePrint

MoorePrint incluye un modo de aprendizaje para personas que administran el negocio y para usuarios que registran operaciones.

## Primera entrada

Al abrir la aplicación por primera vez, cada perfil puede elegir:

- **Ruta de administrador:** configuración, inventario, productos, proveedores, finanzas y respaldos.
- **Ruta de usuario operativo:** clientes, pedidos, producción, cobros y entregas.

La elección y el avance se guardan por usuario en el navegador. No cambian los permisos ni la información del negocio.

## Durante el recorrido

En el Resumen aparece:

- porcentaje de avance;
- siguiente tarea recomendada;
- lista de pasos completados y pendientes;
- opciones para pausar, cambiar o reiniciar la ruta.

Al entrar a una sección aparece una tarjeta que explica:

- para qué sirve;
- cuándo debe usarse;
- qué información modifica;
- cómo abrir la guía completa.

## Botón Guía

El botón **Guía** de la barra superior abre ayuda específica de la pantalla actual. Incluye preparación, procedimiento, errores comunes y la sección relacionada que normalmente sigue.

## Centro de aprendizaje

La sección **Ayuda** permite:

- consultar procedimientos por tarea;
- cambiar la ruta seleccionada;
- volver a mostrar consejos ocultos;
- pausar o continuar el recorrido;
- reiniciar el aprendizaje;
- consultar un glosario administrativo básico.

## Privacidad y funcionamiento sin conexión

El progreso se guarda únicamente en `localStorage`, separado por `user_id` cuando existe un perfil de Supabase. La guía funciona sin conexión y no guarda datos personales adicionales.
