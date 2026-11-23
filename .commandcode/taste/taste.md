# Taste

## Comunicación
- Escribe y quiere las respuestas en español (pide explícitamente "explícamelo en español" / "háblame en español"). Confidence: 0.85

## Arquitectura
- Prefiere feature-first con subcarpetas por rol dentro de cada feature: `modules/<feature>/` con `<feature>.module.ts` en la raíz y `controllers/`, `services/`, `repositories/`, `entities/`, `lib/` creadas solo cuando hacen falta, más `common/` para lo transversal; rechaza las capas DDD (`domain/application/infrastructure/interface`) y también dejar todos los archivos planos sueltos en la carpeta del feature, porque quiere encontrar cada cosa en su sitio ("los archivos ordenados dentro de carpetas services, controller o module", "simple de seguir y escalable"). Confidence: 0.9
- Espera que todos los apps del monorepo sigan el mismo patrón de organización y que no se rompa nada al mover archivos. Confidence: 0.5

## Flujo de trabajo
- Ante refactors grandes de estructura pide primero una recomendación argumentada (como lo haría un senior) y quiere confirmar él mismo antes de que se aplique ("yo te confirmo si lo refactorizamos o no"). Confidence: 0.6

## Estilo de código
- Regla de comentarios: una sola línea `//` en español justo encima de cada función, simple y directa; sin JSDoc ni comentarios de bloque ni comentarios dentro del cuerpo. Tomado como regla permanente. Confidence: 0.9
