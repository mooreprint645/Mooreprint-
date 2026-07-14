# Plan: modo principiante administrativo

Fecha: 2026-07-13

## Alcance

Crear una capa explicativa que enseñe relaciones administrativas sin cambiar datos, cálculos o permisos.

## Tareas

### 1. Modelo de impactos

- Definir consecuencias por sección.
- Definir relaciones de entrada y salida.
- Clasificar impacto informativo, operativo o financiero.
- Agregar ejemplos del trabajo de imprenta.

### 2. Tarjeta contextual por sección

- Insertar una tarjeta en la sección activa.
- Mostrar qué registra, qué cambia y dónde se refleja.
- Permitir ocultar o reactivar el modo principiante.

### 3. Ayuda dentro de formularios

- Detectar formularios principales al abrir un modal.
- Agregar resumen “Al guardar pasará esto”.
- Explicar campos al recibir foco.
- No interceptar el envío ni alterar valores.

### 4. Mapa del negocio

- Agregar flujo de ventas.
- Agregar flujo de materiales.
- Explicar relación de gastos, caja y reportes.
- Permitir navegar a cada sección.

### 5. PWA

- Cargar `beginner-mode.css` y `beginner-mode.js` desde `index.html`.
- Agregar ambos recursos al `APP_SHELL`.
- Incrementar versión de caché.

### 6. Pruebas

- Contrato de carga estática y caché.
- Cobertura de secciones.
- Cobertura de formularios.
- Render de tarjeta contextual.
- Render de panel de formulario.
- Actualización de explicación al enfocar un campo.
- Ejecutar suite completa.

## Fuera de alcance

- Cambiar reglas contables.
- Crear un simulador financiero.
- Modificar Supabase o RLS.
- Cambiar permisos.
- Reorganizar archivos existentes.