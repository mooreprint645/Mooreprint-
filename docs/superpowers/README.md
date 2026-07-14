# Documentos de trabajo

Este directorio conserva decisiones antes de implementar cambios amplios.

## Especificaciones

Ruta:

```text
docs/superpowers/specs/YYYY-MM-DD-tema-design.md
```

Una especificación debe incluir:

- objetivo;
- alcance y fuera de alcance;
- flujo de usuario;
- datos y reglas del negocio;
- módulos afectados;
- permisos y RLS;
- comportamiento local, offline y sincronizado;
- interfaz responsive y accesible;
- impacto en PWA;
- criterios de aceptación;
- estrategia de pruebas.

## Planes

Ruta:

```text
docs/superpowers/plans/YYYY-MM-DD-tema.md
```

Un plan debe indicar:

- archivos exactos;
- responsabilidad de cada archivo;
- interfaces consumidas y producidas;
- pasos pequeños;
- prueba que debe fallar primero;
- implementación mínima;
- comandos y resultados esperados;
- impacto en caché, Supabase y despliegue;
- commits propuestos.

## Regla

No crear documentos para cambios triviales y completamente definidos. Sí son obligatorios para nuevas funciones que cruzan módulos, migraciones, reorganizaciones, rediseños y cambios de datos.
