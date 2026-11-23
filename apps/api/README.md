# API de Vigia (NestJS)

## Estructura

```
src/
├── app.module.ts
├── main.ts
├── common/                     # transversal, sin lógica de negocio
│   ├── common.module.ts
│   ├── config/                 # entorno y AppConfigModule
│   ├── database/               # DataSource, migraciones y DatabaseModule
│   ├── filters/                # filtros HTTP globales
│   ├── guards/                 # AccessTokenGuard
│   ├── llm/                    # cliente de DeepSeek y LlmModule
│   ├── storage/                # puerto y adaptador local de archivos
│   └── utils/                  # parseo de parámetros de consulta
├── modules/                    # una carpeta por capacidad de negocio
│   ├── analysis/
│   │   ├── analysis.module.ts
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── lib/
│   ├── dashboard/
│   │   ├── dashboard.module.ts
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── lib/
│   ├── datasets/
│   │   ├── datasets.module.ts
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── entities/
│   │   └── lib/
│   ├── explanation/            # module, controllers, services
│   ├── export/                 # module, controllers, services
│   ├── forecasting/
│   │   ├── forecasting.module.ts
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── entities/
│   │   └── lib/
│   ├── health/                 # module, controllers
│   ├── ingestion/
│   │   ├── ingestion.module.ts
│   │   ├── controllers/
│   │   ├── services/
│   │   └── lib/
│   └── recommendations/        # module, controllers, services
├── cli/                        # entrypoints con tsx: migraciones y backfills
└── types/                      # declaraciones ambientales
```

## Anatomía de una feature

Cada carpeta de `modules` sigue el mismo patrón y solo crea lo que necesita:

- `<nombre>.module.ts`: registra controladores y providers.
- `controllers/`: rutas HTTP; validan la entrada y delegan.
- `services/`: lógica inyectable (`@Injectable`), incluidos los asesores de IA.
- `repositories/`: consultas SQL/TypeORM.
- `entities/`: entidades TypeORM.
- `lib/`: funciones puras, algoritmos, mappers, constantes y errores.
- `dto/`: solo si la feature define DTOs locales; hoy viven en `@vigia/contracts`.
- `*.spec.ts`: pruebas unitarias junto al archivo que cubren.

## Reglas de dependencia

- Un controlador no accede a la base de datos: usa un servicio o repositorio.
- Una feature importa `CommonModule` cuando usa el guard de acceso.
- `common` no importa `modules`, salvo `common/database/data-source.ts`, que
  registra las entidades para TypeORM.
- Las features se comunican por lo que exporta su `*.module.ts`.
- Los puertos entre capas se inyectan con un símbolo (`STORAGE`, `APP_CONFIG`).

## Convenciones

- Un comentario de una línea en español justo encima de cada función.
- Textos de interfaz y mensajes en español.
- Los repositorios concentran el SQL y no contienen reglas de negocio.
- Los archivos de una misma feature se referencian con rutas relativas cortas:
  `../services/...`, `../lib/...`, `../../common/...`.

## Agregar una feature

1. Crear `modules/<feature>/<feature>.module.ts`.
2. Agregar `controllers/` y `services/`.
3. Sumar `repositories/`, `entities/`, `lib/` o `dto/` solo si hacen falta.
4. Registrar el módulo en `app.module.ts`.

## Comandos

```bash
pnpm --filter @vigia/api dev           # API en modo desarrollo
pnpm --filter @vigia/api build         # compila a dist/
pnpm --filter @vigia/api typecheck     # TypeScript sin emitir
pnpm --filter @vigia/api test          # pruebas unitarias
pnpm --filter @vigia/api test:db       # e2e contra PostgreSQL
pnpm --filter @vigia/api migration:run # aplica migraciones
pnpm --filter @vigia/api backfill      # migra datos legacy
```
