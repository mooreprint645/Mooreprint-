---
name: planning-websites
description: Use when starting or substantially redesigning a website, administrative web application, landing page, catalog, workflow, or multi-screen feature before choosing implementation details
---

# Planeación de sitios y funciones web

## Principio

Definir primero el problema, el usuario y el resultado verificable. No empezar por colores, librerías o archivos.

## Cuándo usar

- Nueva pantalla o flujo completo.
- Rediseño de navegación.
- Función que afecta varios módulos.
- Página pública, catálogo o landing.
- Cambio de arquitectura o persistencia.

No usar para correcciones de texto o estilos completamente especificados.

## Proceso

1. Revisar `AGENTS.md`, `docs/architecture.md`, archivos relacionados y pruebas existentes.
2. Identificar usuario, tarea principal, frecuencia y contexto: celular, mostrador, producción o administración.
3. Definir éxito con comportamientos observables.
4. Separar requisitos indispensables de ideas futuras.
5. Proponer hasta tres alternativas con costos y riesgos.
6. Seleccionar una solución mínima que respete la arquitectura actual.
7. Documentar datos, estados, errores, permisos, sincronización, PWA y pruebas.
8. Guardar la especificación en `docs/superpowers/specs/YYYY-MM-DD-tema-design.md`.

## Preguntas obligatorias para MoorePrint

- ¿Qué tarea del negocio acelera o protege?
- ¿Qué datos crea, cambia o elimina?
- ¿Afecta inventario, caja, saldos o reportes?
- ¿Debe funcionar sin conexión?
- ¿Qué sucede cuando Supabase no responde?
- ¿Qué permiso y política RLS necesita?
- ¿Qué verá el usuario en celular?
- ¿Cómo se recupera de un error o envío duplicado?

## Salida mínima

- Objetivo y fuera de alcance.
- Flujo principal y alternos.
- Datos de entrada y salida.
- Módulos afectados.
- Estados vacío, carga, éxito y error.
- Reglas de seguridad.
- Estrategia de pruebas.
- Impacto en caché y despliegue.

## Errores comunes

- Convertir una petición simple en una plataforma completa.
- Añadir framework sin necesidad demostrada.
- Diseñar solo para escritorio.
- Olvidar modo sin conexión o sincronización parcial.
- Duplicar cálculos que ya existen en `accounting-math.js` o `app-core.js`.
