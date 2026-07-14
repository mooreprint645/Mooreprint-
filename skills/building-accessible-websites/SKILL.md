---
name: building-accessible-websites
description: Use when implementing or reviewing navigation, forms, buttons, links, dialogs, menus, tables, status messages, animations, keyboard interaction, focus, semantics, or color contrast
---

# Accesibilidad web

## Principio

Toda tarea operativa debe poder completarse con teclado, texto claro y estructura semántica, sin depender únicamente de color, posición o iconos.

## Reglas obligatorias

- Usar elementos semánticos para su propósito real.
- Mantener orden lógico de encabezados.
- Asociar cada control con una etiqueta accesible.
- Mostrar errores junto al campo y resumirlos cuando sea necesario.
- Mantener foco visible.
- Devolver el foco al elemento correcto al cerrar un modal.
- Permitir cerrar diálogos con teclado sin perder cambios accidentalmente.
- Anunciar estados de carga, guardado, sincronización y error.
- Proporcionar texto alternativo útil en imágenes informativas.
- No usar color como único indicador de estado o saldo.
- Respetar `prefers-reduced-motion`.

## Formularios MoorePrint

- Marcar campos obligatorios antes del envío.
- Conservar el valor escrito después de un error.
- Usar tipos de entrada adecuados para teléfono, correo, fecha y cantidades.
- Explicar unidades, impuestos, descuentos y formatos esperados.
- Prevenir dobles envíos y anunciar cuando el registro se guardó localmente pero aún no se sincroniza.

## Tablas y paneles

- Incluir encabezados de columna claros.
- Mantener relación entre etiqueta y valor en la vista móvil tipo tarjeta.
- Ofrecer texto para iconos de editar, cobrar, imprimir o eliminar.
- No depender de tooltip para una acción esencial.

## Comprobación

1. Navegar solo con teclado.
2. Probar foco dentro de modales.
3. Revisar mensajes con lector de pantalla o árbol de accesibilidad.
4. Verificar contraste y zoom.
5. Probar errores, conexión lenta y estado sin conexión.

## Errores comunes

- Añadir `aria-label` para compensar HTML incorrecto.
- Usar `tabindex` positivo.
- Ocultar contenido enfocado.
- Anunciar cada cambio del dashboard y saturar al usuario.
- Colocar texto de bajo contraste sobre fondos amarillos o grises.
