# Vigia general: datasets flexibles — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Vigia acepte cualquier dataset de salud, entienda sus columnas con ayuda de la IA y genere un tablero, un pronóstico y pestañas de alertas/anomalías/recomendaciones que se adaptan a los datos subidos.

**Architecture:** Cada columna recibe un rol (fecha, tiempo, lugar, categoría, valor medido, cantidad, identificador, no usar). Las filas útiles se guardan tipadas en `dataset_rows` (jsonb). Un "indicador" (conteo, suma de cantidad o promedio de un valor medido) produce una serie semanal por lugar con la misma forma que la serie epidemiológica actual, de modo que los núcleos existentes (anomalías, recomendaciones, explicación, pronóstico) se reutilizan. La capa epidemiológica actual (`surveillance_cases`) se sigue llenando cuando el dataset la soporta, para conservar la paridad.

**Tech Stack:** NestJS 12 + TypeORM + PostgreSQL 16, Next.js 16 + TanStack Query + Recharts, `@vigia/epidemiology` (núcleos puros, vitest), `@vigia/contracts` (zod).

**Spec:** `docs/superpowers/specs/2026-11-22-datasets-flexibles-design.md`

## Global Constraints

- Sin columnas obligatorias: solo bloquean archivo vacío/ilegible, columnas de datos personales (`pii_aliases`) o ninguna columna con rol útil.
- La IA nunca decide cifras, niveles ni anomalías; fuera del dengue propone hasta 2 acciones por alerta marcadas "Sugerida por IA, revisar con el equipo".
- A la IA solo van fechas y valores repetidos (`sharedSamples` actual) o hechos agregados; nunca filas ni identificadores.
- Identificadores y columnas "No usar" no se guardan en `dataset_rows`.
- Los snapshots de paridad de dengue (`apps/api/test/snapshots/ingest_*.json`, `api_*.json`) no cambian.
- Tiempo = fecha, o año + semana, o año + mes. Granularidad del tablero: día si el rango ≤ 90 días, semana epidemiológica si ≤ 3 años, mes si es mayor.
- Las pestañas adaptativas (Análisis, Recomendaciones, Explicación) requieren tiempo semanal (fecha o año + semana); con solo año + mes muestran un mensaje que explica qué falta.
- Pronóstico publicado solo si MASE < 1; temporada 52 (semanal) o 12 (mensual); proyección a 5 años solo para conteo o suma.
- Se quita "Todos los archivos" de la interfaz; los endpoints epidemiológicos conservan el modo sin `upload_id`.
- Textos de interfaz en español; un comentario de una línea en español sobre cada función (regla del usuario).
- No hacer commits sin que el usuario lo pida: al cerrar cada fase se informa y se pregunta.

## Review Focus

- Archivo con una sola fila o con todas las fechas iguales → el tablero muestra los KPIs y omite la serie y el pronóstico, sin errores (Task 6, test `omite la serie con un solo periodo`).
- Valor medido con texto mezclado ("11,2", "s/d", vacío) → se ignoran los no numéricos y se acepta la coma decimal (Task 2, test `lee números con coma decimal y omite basura`).
- Categoría con cientos de valores (distritos usados como categoría) → barras con los 10 primeros + "Otros", nunca 300 barras (Task 6, test `agrupa en Otros pasadas 10 barras`).
- Dataset sin lugar pero con tiempo → pestañas adaptativas trabajan sobre un único lugar "Total" (Task 10, test `usa Total cuando no hay lugar`).
- Cambiar de archivo mientras carga el tablero → la consulta usa `upload_id` en la clave y `keepPreviousData`; no se mezclan datos (Task 7, revisión en navegador).

---

## Fase 1 — Datos genéricos (carga de cualquier archivo)

### Task 1: Roles de columna e indicadores en el núcleo y el contrato

**Files:**

- Create: `packages/epidemiology/src/roles.ts`, `packages/epidemiology/src/roles.spec.ts`
- Modify: `packages/epidemiology/src/index.ts`, `packages/contracts/src/uploads.ts`, `packages/contracts/src/index.ts`

**Interfaces:**

- Produces:
  - `COLUMN_ROLES = ['date','year','week','month','place','category','measure','count','identifier','ignore'] as const`; `type ColumnRole`
  - `PLACE_LEVELS = ['department','province','district','location','ubigeo'] as const`; `type PlaceLevel`
  - `ROLE_INFO: readonly { id: ColumnRole; label: string; description: string }[]` (español: Fecha, Año, Semana, Mes, Lugar, Categoría, Valor medido, Cantidad, Identificador, No usar)
  - `PLACE_LEVEL_INFO: readonly { id: PlaceLevel; label: string }[]`
  - `interface DatasetColumn { name: string; label: string; role: ColumnRole; level: PlaceLevel | null; field: MappingTarget | null; kind: 'date' | 'number' | 'text' }`
  - `interface TimeSupport { kind: 'date' | 'week' | 'month' | 'year' | 'none' }` y `timeSupport(columns: readonly DatasetColumn[]): TimeSupport`
  - `validateColumns(columns: readonly DatasetColumn[]): DatasetColumn[]` — fuerza: a lo sumo un `date` (el primero), un `count`, uno de `year/week/month`; `level` solo si `role === 'place'`; lanza `Error('ninguna columna útil')` si todas son `identifier`/`ignore`.
  - `toEpiMapping(columns): Record<string, string>` — deriva el mapeo de `fields.ts`: `date→event_date`, `year→year`, `week→epi_week`, `count→cases`, `place` según `level` (`location→location`, etc.), y `field` cuando no es null.
- Contract (`uploads.ts`): `DatasetColumnSchema`, `UploadPreviewSchema.columns[]` pasa a `{ name, samples, kind, label, role, level, field, reason }`; agrega `title: string`, `topic: string`, `roles: ROLE_INFO[]`, `place_levels`; elimina `targets` y `requirements`. `UploadSchema` agrega `title`, `topic`, `columns: DatasetColumn[]`, `time: TimeSupport['kind']`, `epi: boolean`.

- [ ] **Step 1: Tests en `roles.spec.ts`:** `toEpiMapping` de un dataset dengue devuelve exactamente el `mapping` de `apps/api/test/snapshots/api_preview_demo.json`; `timeSupport` → `'week'` con year+week, `'month'` con year+month, `'date'` con date, `'none'` sin tiempo; `validateColumns` deja solo la primera `date` y anula `level` fuera de `place`; lanza con solo identificadores.
- [ ] **Step 2:** `pnpm --filter @vigia/epidemiology test` → FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar `roles.ts` y los esquemas del contrato.
- [ ] **Step 4:** Tests en verde; `pnpm --filter @vigia/epidemiology build && pnpm --filter @vigia/contracts build`.

### Task 2: Perfilado y sugerencia de roles (reglas + IA)

**Files:**

- Create: `apps/api/src/modules/ingestion/application/profile.ts`, `profile.spec.ts`
- Modify: `apps/api/src/modules/ingestion/infrastructure/column-advisor.ts` (+ spec), `apps/api/src/modules/ingestion/application/ingest.ts` (`previewUpload`, `mergeSuggestions`), `apps/api/src/modules/ingestion/domain/columns.ts`, `apps/api/config/mappings/minsa_dengue.yaml` (quitar `count_rows`)

**Interfaces:**

- Consumes: Task 1 (`DatasetColumn`, `ROLE_INFO`, `validateColumns`, `MAPPING_TARGET_INFO`).
- Produces:
  - `profileColumn(name: string, values: readonly string[]): { kind: 'date'|'number'|'text'; distinct: number; filled: number }` (fecha si ≥ 75 % `parseDate`; número si ≥ 90 % `parseNumber`).
  - `parseNumber(text: string): number | null` en `packages/epidemiology/src/fields.ts` (acepta `11,2` y `11.2`, rechaza texto).
  - `ruleSuggestion(name, profile, aliasMapping): { role, level, field }` — alias del YAML primero (campo → rol: `event_date→date`, `year→year`, `epi_week→week`, `cases→count`, `department/province/district/location/ubigeo→place` con ese nivel, `sex/age_type/diagnosis/diagnosis_type/directorate/disease→category` con `field`, `age_group→measure` con `field`); si no, por perfil: fecha→`date`, número con ≤ 50 % distintos→`measure`, texto con 2–50 distintos→`category`, texto casi único→`identifier`.
  - `ColumnSuggestion` pasa a `{ column, label, role, level, field, reason }`; `SuggestColumns` recibe también `{ title: string }` (nombre de archivo) y devuelve `{ title, topic, columns } | null`.
  - Prompt del asesor: roles y niveles de `ROLE_INFO`/`PLACE_LEVEL_INFO`, campos internos de `MAPPING_TARGET_INFO`, misma regla de fecha principal; responde `{"title","topic","columns":[{"column","label","role","level","field","reason"}]}`. `parseSuggestions` valida roles/niveles/campos conocidos y aplica `validateColumns`.
  - `previewUpload` devuelve el contrato de Task 1; `title` por defecto = nombre de archivo sin extensión, `topic` por defecto = `''`.

- [ ] **Step 1: Tests:** `profile.spec.ts` (`lee números con coma decimal y omite basura`: `['11,2','10.5','s/d','']` → number; `detecta fechas`; `texto casi único es identificador`); `ingest.spec.ts` actualizado: egresos → `fecing: date`, `PROCEDENCIA: place/location`, `sexo: category/field sex`, `edad: measure/field age_group`, `Id: identifier`; anemia sintético sin fecha (`distrito;sexo;edad_meses;hemoglobina;anemia`) → `hemoglobina: measure`, `anemia: category`, ninguno bloqueante; demo dengue → `toEpiMapping(columns)` igual al snapshot; `column-advisor.spec.ts` con roles inválidos descartados y `title/topic` recortados.
- [ ] **Step 2:** `pnpm --filter @vigia/api exec vitest run src/modules/ingestion` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Tests en verde, incluidos los de paridad `ingestion parity with the frozen fixtures`.

### Task 3: Almacenamiento genérico y carga

**Files:**

- Create: `apps/api/src/shared/database/migrations/1700000002000-generic-datasets.ts`, `apps/api/src/modules/datasets/infrastructure/persistence/dataset-row.entity.ts`, `apps/api/src/modules/ingestion/application/typed-rows.ts` (+ spec)
- Modify: `migrations/index.ts`, `upload.entity.ts`, `upload.mapper.ts`, `ingestion.service.ts`, `ingest.ts` (`ingestUpload`), `ingestion.controller.ts`, `datasets.service.ts` (lista con `title/topic/columns/time/epi`)

**Interfaces:**

- Consumes: Task 1, Task 2.
- Produces:
  - Migración: `uploads` + `title text NOT NULL DEFAULT ''`, `topic text NOT NULL DEFAULT ''`, `columns jsonb NOT NULL DEFAULT '[]'`; tabla `dataset_rows (upload_id int REFERENCES uploads ON DELETE CASCADE, row_number int, data jsonb NOT NULL, PRIMARY KEY (upload_id,row_number))`.
  - `typedRows(raw: Record<string,string>[], columns: DatasetColumn[]): Record<string, string | number | null>[]` — solo columnas con rol distinto de `identifier`/`ignore`; `date` → `YYYY-MM-DD` (`parseDate`), `measure`/`count`/`year`/`week`/`month` → `parseNumber`, resto texto recortado (lugar con `location` se guarda tal cual; se separa al consultar con `splitLocation`).
  - `POST /api/upload` acepta campo `columns` (JSON de `DatasetColumn[]`, validado con `validateColumns`), `title`, `topic`; si falta `columns` (compatibilidad), usa la sugerencia por reglas. El `mapping` epidemiológico se deriva con `toEpiMapping`.
  - `ingestUpload` llena la capa epidemiológica solo si `missingRequirements(Object.keys(toEpiMapping(columns)))` está vacío; si no, `rowsValid` cuenta filas genéricas guardadas y no hay `surveillance_cases`. `disease` = `topic` en mayúsculas o el del YAML si `topic` vacío.
  - `UploadDto.epi = true` cuando la carga tiene filas en `surveillance_cases`.

- [ ] **Step 1: Tests:** `typed-rows.spec.ts` (no guarda `Id`; hemoglobina `'11,2'` → `11.2`; fecha `14/07/2026` → `'2026-07-14'`); e2e nuevo en `apps/api/test/ingestion.e2e-spec.ts`: `carga un dataset de anemia sin fecha` → 200, `epi: false`, `dataset_rows` = filas, `surveillance_cases` = 0; los e2e de dengue y egresos siguen pasando con `epi: true`.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar migración, entidad, carga.
- [ ] **Step 4:** `VIGIA_DB_TESTS=1 pnpm --filter @vigia/api test` en verde.

### Task 4: Relleno de cargas existentes

**Files:**

- Create: `apps/api/src/cli/backfill-generic.ts`; script `backfill:generic` en `apps/api/package.json`

**Interfaces:**

- Consumes: Task 2 (`ruleSuggestion`), Task 3 (`typedRows`, entidades).
- Produces: comando idempotente que, para cada `uploads` con `columns = '[]'`, lee `raw_storage_key` del storage, deriva columnas desde el `mapping` guardado (campo → rol de Task 2), escribe `columns`, `title` (nombre de archivo), `topic` (`'dengue'` si `source = 'minsa_dengue'`) y `dataset_rows`. No toca `surveillance_cases`.

- [ ] **Step 1:** Test e2e `rellena una carga antigua sin columnas`: subir demo, vaciar `columns` y `dataset_rows` por SQL, correr la función exportada `backfillGeneric(dataSource, storage)` → `columns` y filas restauradas.
- [ ] **Step 2–4:** FAIL → implementar → verde. Ejecutar sobre la base de desarrollo `vigia_ts` y verificar las cargas 1 y 3.

### Task 5: Modal de revisión con roles (web)

**Files:**

- Modify: `apps/web/src/modules/shared/components/layout/mapping-dialog.tsx`, `dashboard-layout.tsx`, `apps/web/src/modules/shared/services/uploads.service.ts` (`createUpload(file, review: { columns, title, topic })`), `use-upload-mutations.ts`, `apps/web/app/globals.css` (`.map-*`)

**Interfaces:**

- Consumes: contrato de Task 1, endpoint de Task 3.
- Produces: modal con título y tema editables arriba; por columna, selector de rol (`ROLE_INFO` del preview) y, si el rol es Lugar, segundo selector de nivel; avisos informativos (no bloqueantes): "Sin fecha no habrá evolución ni pronóstico", "Sin lugar no habrá ranking por zona", "Sin cantidad, cada fila cuenta como un registro". Solo bloquean datos personales o ninguna columna útil.

- [ ] **Step 1:** `pnpm --filter @vigia/web typecheck` y lint en verde.
- [ ] **Step 2:** Revisión en navegador (Playwright) con egresos, anemia sintético y demo dengue: claro, oscuro y 390 px.

**Cierre de fase 1:** informar al usuario y preguntar si hace commit.

---

## Fase 2 — Tablero adaptable

### Task 6: Núcleo del tablero

**Files:**

- Create: `packages/epidemiology/src/dashboard.ts`, `dashboard.spec.ts`; contrato `packages/contracts/src/dashboard.ts`

**Interfaces:**

- Consumes: Task 1.
- Produces:
  - `type Indicator = { kind: 'records' } | { kind: 'sum'; column: string } | { kind: 'mean'; column: string }`; `defaultIndicator(columns): Indicator` (suma de `count` si existe, si no `records`); `indicatorOptions(columns): { id: string; label: string; indicator: Indicator }[]` (registros, suma de cantidad, promedio de cada `measure`).
  - `chooseGranularity(first: string, last: string): 'day' | 'week' | 'month'` (umbrales de Global Constraints).
  - `planWidgets(facts: DatasetFacts, indicator: Indicator): WidgetPlan[]` donde `DatasetFacts = { columns, rows: number, periods: number, places: number, categories: Record<string, number>, years: number }` y `WidgetPlan = { id: string; type: 'kpis'|'timeseries'|'interannual'|'ranking'|'heatmap'|'breakdown'|'histogram'; title: string; column?: string }`. Reglas: `timeseries` si `periods ≥ 2`; `interannual` si `years ≥ 2`; `ranking` si `places ≥ 2`; `heatmap` si hay tiempo y `2 ≤ places ≤ 40`; `breakdown` por categoría con ≥ 2 valores (más de 10 → top 10 + "Otros"); `histogram` por `measure` con ≥ 5 valores distintos. Títulos por plantilla: `"{Indicador} por {granularidad}"`, `"{Indicador} por {lugar}"`, `"Distribución de {label}"`.
  - Contrato `DashboardResponseSchema = { title, topic, indicator: { id, label, options }, granularity, kpis: {label,value,hint}[], widgets: Widget[] }`, con `Widget` unión discriminada por `type` y sus datos (`points: {period,label,value}[]`, `rows: {name,value}[]`, `bins: {from,to,count}[]`, `matrix: {rows,columns,values}`).

- [ ] **Step 1: Tests:** `omite la serie con un solo periodo`; `agrupa en Otros pasadas 10 barras`; `sin lugar no hay ranking ni mapa de calor`; `granularidad por rango` (60 días → day, 2 años → week, 5 años → month); `indicador por defecto suma la cantidad`; `títulos en español con el nombre de la columna`.
- [ ] **Step 2–4:** FAIL → implementar → verde.

### Task 7: Endpoint del tablero y pantalla Tablero

**Files:**

- Create: `apps/api/src/modules/dashboard/` (módulo, `dashboard.repository.ts` con SQL sobre `dataset_rows`, `dashboard.service.ts`, `dashboard.controller.ts` `GET /api/dashboard?upload_id&indicator&year`), e2e `apps/api/test/dashboard.e2e-spec.ts`
- Create (web): `apps/web/src/modules/tablero/` (`components/tablero-page.tsx`, widgets `kpi-row`, `time-widget`, `ranking-widget`, `heatmap-widget`, `breakdown-widget`, `histogram-widget`; `hooks/use-dashboard.ts`; `services/dashboard.service.ts`; `index.ts`), `app/(dashboard)/page.tsx` → Tablero
- Modify: `apps/web/src/modules/shared/constants/navigation.ts`, `query-keys.ts`, `topbar.tsx` (selector Indicador; sin "Todos los archivos"; archivo por defecto = el más reciente), `dashboard-filters.tsx` (agrega `indicator`), `dashboard-layout.tsx`; eliminar `apps/web/src/modules/resumen/` (el aviso de recomendación se mueve a `tablero` y solo se muestra si `epi`).

**Interfaces:**

- Consumes: Task 6, Task 3 (`dataset_rows`, `UploadDto.columns/epi/time`).
- Produces: `useDashboard(uploadId: number, indicator: string, year: number | null)` con `queryKeys.dashboard(uploadId, indicator, year)`; navegación filtrada por capacidades: `navItemsFor(upload: UploadDto): NavItem[]` (Tablero, Pronóstico y Archivos siempre; Análisis, Recomendaciones y Explicación si `upload.time` es `date` o `week`).
- El repositorio agrega en SQL: conteo/suma/promedio por periodo (`date_trunc` o año+semana/mes), por lugar (separando `location` con la misma regla que `splitLocation` en una función SQL o en memoria si hay ≤ 200 000 filas — decisión del implementador), por categoría, e histograma con `width_bucket`.

- [ ] **Step 1:** e2e: anemia sin fecha → sin `timeseries`, con `breakdown` de `anemia` y `histogram` de `hemoglobina`; egresos → `timeseries` semanal y `ranking` con 25 departamentos; `upload_id` inexistente → 404.
- [ ] **Step 2–4:** FAIL → implementar → verde.
- [ ] **Step 5:** Revisión en navegador con los tres archivos (claro, oscuro, 390 px); cambiar de archivo e indicador sin mezclar datos.

**Cierre de fase 2:** informar y preguntar por commit.

---

## Fase 3 — Pronóstico genérico

### Task 8: Pronóstico del indicador

**Files:**

- Create: `packages/epidemiology/src/indicator-forecast.ts` (+ spec), `apps/api/src/modules/forecasting/application/indicator-forecast.service.ts`, endpoint `GET /api/forecast/indicator?upload_id&indicator`, contrato `IndicatorForecastSchema`
- Modify (web): `apps/web/src/modules/pronostico/` (sección "Indicador del archivo" arriba; la sección por departamento actual solo si `epi`)

**Interfaces:**

- Consumes: `seasonalDriftForecast`, `rollingBacktest`, `scorecardRow` (`forecast.ts`), `buildOutlook`/`projectAnnual` (`outlook.ts`), serie del indicador del repositorio de Task 7.
- Produces: `forecastIndicator(values: readonly number[], granularity: 'week'|'month'): { status: ForecastStatus; mase: number | null; horizon: {step,p10,p50,p90}[]; reason: string | null }` — temporada 52/12, horizonte 4 semanas o 3 meses, requiere 2 temporadas (si no, `status: 'insufficient_evidence'` y `reason` en español "Se necesitan al menos 2 años de datos semanales"); granularidad `day` se agrega a semana antes de pronosticar. Proyección anual solo si el indicador es `records` o `sum`.

- [ ] **Step 1: Tests:** serie sintética estacional de 3 años → `publish` con MASE < 1; 1 año → `insufficient_evidence` con motivo; serie de promedios → funciona igual; indicador `mean` → sin proyección anual.
- [ ] **Step 2–4:** FAIL → implementar → verde; revisión en navegador.

**Cierre de fase 3:** informar y preguntar por commit.

---

## Fase 4 — Pestañas adaptativas

### Task 9: Núcleos parametrizados por indicador

**Files:**

- Modify: `packages/epidemiology/src/recommendations.ts` (+ spec), `packages/epidemiology/src/explain.ts` (+ spec)

**Interfaces:**

- Produces:
  - `buildRecommendations(inputs, options?: RecommendationOptions)` con `RecommendationOptions = { indicatorLabel: string; direction: 'up' | 'both'; actions: 'dengue' | 'general'; minChange: number }`; por defecto `{ indicatorLabel: 'Casos', direction: 'up', actions: 'dengue', minChange: MIN_CASES_FOR_CHANGE }` (paridad). Con `direction: 'both'`, una caída fuerte también sube el nivel. Los motivos usan `indicatorLabel` ("Hemoglobina promedio en baja: 11,2 → 10,4 (−7 %)").
  - `GENERAL_LEVEL_ACTIONS` y `GENERAL_ACTION_TABLE` con redacción neutra (sin vectores ni criaderos); `topDrivers`/`recommend(drivers, actions)` usa la tabla elegida.
  - `isDengueTopic(topic: string): boolean` → `normalizeHeader(topic).includes('dengue')`.

- [ ] **Step 1: Tests:** los specs actuales siguen en verde sin cambios (paridad); `con direction both una caída del 20 % es alerta`; `motivos usan el nombre del indicador`; `tabla general no menciona criaderos`; `isDengueTopic('Dengue 2024') === true`.
- [ ] **Step 2–4:** FAIL → implementar → verde.

### Task 10: Fuente de series por indicador y servicios adaptativos

**Files:**

- Create: `apps/api/src/modules/analysis/infrastructure/indicator-series.repository.ts` (+ e2e)
- Modify: `analysis.service.ts`, `forecasting.service.ts`, `recommendations.service.ts`, `explanation.service.ts` y sus controladores (parámetro opcional `indicator`)

**Interfaces:**

- Consumes: Task 6 (`Indicator`), Task 9.
- Produces: `IndicatorSeriesRepository.weekly(uploadId: number, indicator: Indicator): Promise<{ department: string; year: number; epi_week: number; cases: number }[]>` — lugar al nivel departamento (o el nivel disponible más alto; `'Total'` si no hay lugar), semana desde `date` (`epiWeekOf`) o `year`+`week`. Regla de fuente: si la carga es `epi` y el indicador es el por defecto, los servicios usan `AnalysisRepository.weeklyCases` (paridad); en cualquier otro caso usan `IndicatorSeriesRepository.weekly`. Con tiempo `month`/`year`/`none` los endpoints adaptativos responden 200 con `{ unavailable: 'Se necesitan fechas o semanas para detectar anomalías.' }` (campo opcional añadido a los contratos de análisis, recomendaciones y explicación).

- [ ] **Step 1:** e2e: `usa Total cuando no hay lugar` (dataset con fecha y sin lugar → anomalías con `department: 'Total'`); egresos → recomendaciones con `actions: 'general'`; demo dengue → respuestas idénticas a los snapshots actuales; anemia sin fecha → `unavailable`.
- [ ] **Step 2–4:** FAIL → implementar → verde.

### Task 11: Acciones sugeridas por la IA y pantallas adaptativas

**Files:**

- Create: `apps/api/src/modules/recommendations/infrastructure/action-advisor.ts` (+ spec)
- Modify: `recommendations.service.ts`, contrato `RecommendationItemSchema` (+ `actions_source: 'rules' | 'deepseek'`), web `recomendaciones/`, `analisis/`, `explicacion/` (textos con `indicatorLabel`, mensaje `unavailable`, marca "Sugerida por IA, revisar con el equipo")

**Interfaces:**

- Consumes: Task 9, Task 10, `DeepSeekClient`.
- Produces: `ActionAdvisor.suggest(facts: { topic: string; indicator: string; items: { place: string; level: AlertLevel; reasons: string[] }[] }): Promise<Record<string, string[]> | null>` — solo para items `alto`/`medio`, máximo 2 acciones por lugar, ≤ 20 palabras cada una, sin dosis ni indicaciones clínicas; `parseActions` descarta lugares inventados. Sin IA o con dengue, se usan las tablas de Task 9.

- [ ] **Step 1: Tests:** `parseActions` descarta lugares inexistentes y recorta a 2; el servicio con IA simulada marca `actions_source: 'deepseek'`; dengue nunca llama a la IA para acciones.
- [ ] **Step 2–4:** FAIL → implementar → verde.
- [ ] **Step 5:** Revisión en navegador con los tres archivos.

### Task 12: Textos generales y cierre

**Files:**

- Modify: `apps/web/app/layout.tsx` (título "Vigia, análisis de datos de salud"), `navigation.tsx` (etiqueta de marca), `packages/contracts` `DISCLAIMER` genérico, `apps/web/src/modules/shared/components/ui/empty-state.tsx` (copia genérica), `apps/api` prompts que dicen "dengue" fuera del caso dengue, `README.md`, `src/modules/README.md`

- [ ] **Step 1:** `rg -i "dengue" apps/web/src apps/web/app` solo devuelve usos condicionados al tema.
- [ ] **Step 2:** Suite completa: `pnpm build && pnpm typecheck && pnpm lint && pnpm test` y `VIGIA_DB_TESTS=1 pnpm --filter @vigia/api test`.
- [ ] **Step 3:** Revisión final en navegador y reporte al usuario; preguntar por commit.
