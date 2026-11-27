# Vigia general: tableros que se adaptan al dataset subido

Fecha: 2026-11-22 · Estado: borrador para aprobación

## Intención

Vigia deja de ser una herramienta solo de dengue. El usuario sube cualquier dataset de salud
(dengue, anemia, ingresos hospitalarios, etc.) y Vigia lo entiende, arma solo un tablero de
gráficos e indicadores, al estilo de un Power BI automático, y agrega predicciones cuando los
datos lo permiten. Nada es fijo: lo que se muestra depende de las columnas que trae el archivo,
y si algo no se puede calcular simplemente no aparece, sin errores.

## Objetivos

- Aceptar cualquier archivo tabular (CSV/XLSX) sin columnas obligatorias.
- Entender cada columna (qué es y cómo usarla) con ayuda de la IA, confirmado por el usuario.
- Generar automáticamente un tablero coherente con lo que hay en los datos.
- Predecir la evolución en el tiempo cuando hay fechas e historia suficiente, y solo publicarla
  cuando el modelo demuestra ser mejor que una referencia simple.
- Mantener las funciones epidemiológicas actuales (anomalías, alertas, recomendaciones,
  explicación) para los datasets que las soportan.

## No objetivos (por ahora)

- Que el usuario arme sus propios gráficos a mano (enfoque C). Puede sumarse después.
- Indicadores derivados con fórmulas (por ejemplo, "anemia si hemoglobina < 11").
- Cruzar o unir varios datasets entre sí.
- Exportar el dataset genérico (la exportación actual de la capa epidemiológica se mantiene).

## Anti-objetivos (fracaso aunque "funcione")

- Que la IA decida números, alertas o acciones. La IA solo nombra y sugiere; las cifras y los
  gráficos salen de reglas deterministas.
- Que un archivo válido falle o muestre una pantalla rota porque le falta una columna "esperada".
- Que se guarden o se envíen a la IA identificadores de personas.
- Que se muestren predicciones no confiables como si lo fueran.

## Restricciones

- Stack actual: NestJS + PostgreSQL + TypeORM, Next.js con TanStack Query, paquetes
  `@vigia/epidemiology` (núcleos puros) y `@vigia/contracts` (zod).
- La capa epidemiológica actual debe seguir dando exactamente los mismos resultados para los
  archivos de dengue existentes (tests de paridad con snapshots).
- Privacidad: se mantiene el rechazo por columnas de datos personales (DNI, nombre…), y a la IA
  solo van fechas y valores que se repiten mucho (regla ya implementada).
- Regla de estilo del proyecto: un comentario de una línea en español sobre cada función.

## Enfoques considerados

- **A. Vigia entiende el archivo y arma el tablero solo (elegido).** La IA y un perfilado
  automático asignan un rol a cada columna; el tablero se construye por reglas según los roles
  presentes. Es general y no requiere programar cada tema nuevo. Costo: cambio grande en
  almacenamiento y pantallas.
- **B. Perfiles fijos por tema.** Más simple, pero cada tema nuevo exige programación. Va contra
  el objetivo de ser general. Descartado.
- **C. El usuario arma sus gráficos.** Máxima flexibilidad, mayor tamaño y traslada el trabajo
  al usuario. Queda como posible extensión sobre A.

El usuario delegó el cómo ("si lo recomiendas, aplícalo") y aprobó avanzar con A.

## Diseño

### 1. Roles de columna

Cada columna recibe un rol, un nombre en español y un tipo inferido:

| Rol                | Qué es                                                                                | Ejemplos                                |
| ------------------ | ------------------------------------------------------------------------------------- | --------------------------------------- |
| Fecha              | Momento del registro                                                                  | fecha de ingreso, fecha de notificación |
| Año / Semana / Mes | Tiempo ya partido en columnas                                                         | año, semana epidemiológica              |
| Lugar              | Ubicación, con nivel: departamento, provincia, distrito, ubicación combinada o UBIGEO | PROCEDENCIA, distrito                   |
| Categoría          | Texto con pocos valores distintos                                                     | sexo, diagnóstico, tipo de seguro       |
| Valor medido       | Número que se promedia                                                                | hemoglobina, edad, peso                 |
| Cantidad           | Número de casos que representa la fila                                                | casos                                   |
| Identificador      | Código de registro que no es dato personal                                            | Id, codigo_registro                     |
| No usar            | Cualquier otra columna                                                                | fecha de corte, observaciones           |

- Un perfilado determinista calcula para cada columna su tipo (fecha, número, texto), cuántos
  valores distintos tiene y unos ejemplos. La IA, con ese perfil y los ejemplos seguros, sugiere
  rol, nombre en español y, para el dataset completo, un **título** y un **tema** (por ejemplo,
  "Egresos hospitalarios 2026", tema "egresos hospitalarios"). Sin IA, las reglas por nombre de
  columna y el perfil hacen la sugerencia.
- El servidor valida todo: roles conocidos, columnas reales, a lo sumo una fecha principal y una
  cantidad. Si hay varias fechas, una es la principal (la más cercana al inicio del caso) y el
  resto queda en "No usar" salvo que el usuario elija otra cosa.
- No hay columnas obligatorias. Lo único que bloquea una carga es: archivo vacío o ilegible,
  columnas con datos personales, o ninguna columna utilizable.

### 2. Modal de revisión

Se mantiene el modal actual (columna real, nombre en español de la IA, ejemplos, motivo), con
estos cambios:

- "Se usará como" ofrece roles en lugar de campos de dengue. Al elegir **Lugar**, aparece un
  segundo selector con el nivel.
- Arriba, título y tema del dataset, sugeridos y editables.
- Los indicadores "Cuándo ocurrió / Dónde ocurrió" dejan de ser obligatorios y pasan a ser
  informativos: "Con fecha podrás ver la evolución y predicciones", "Sin lugar no habrá
  ranking por zona".

### 3. Almacenamiento

- `uploads` suma: `title`, `topic` y `columns` (jsonb con nombre, nombre en español, rol, nivel
  de lugar y tipo de cada columna).
- Tabla nueva `dataset_rows (upload_id, row_number, data jsonb)` con los valores ya tipados
  (números como número, fechas como `YYYY-MM-DD`, texto recortado). Solo se guardan columnas con
  rol útil; los **identificadores y las columnas "No usar" no se guardan**. Índice por
  `upload_id`.
- **Capa epidemiológica derivada:** si el dataset tiene tiempo (fecha, o año + semana) y un lugar
  que llegue a departamento, además se llena `surveillance_cases` igual que hoy (casos =
  cantidad o 1 por fila; enfermedad = tema). Así las pantallas epidemiológicas actuales siguen
  funcionando sin reescribirse y los tests de paridad se mantienen.

### 4. Tablero (nueva pantalla principal)

El servidor arma una lista de "widgets" por reglas deterministas según los roles presentes. Cada
widget solo se genera si los datos lo soportan (hay valores, hay variación, hay suficientes
puntos); si no, no aparece.

- **Indicador:** número de registros, suma de la cantidad o promedio de un valor medido. Un
  selector "Indicador" en la barra superior permite cambiarlo; por defecto, la cantidad si
  existe, si no el número de registros.
- **Indicadores clave:** registros, indicador elegido, lugares distintos, rango de fechas.
- **Evolución en el tiempo** (si hay fecha): granularidad automática según el rango (día si es de
  hasta 90 días, semana epidemiológica si es de hasta 3 años, mes si es mayor).
- **Comparación entre años** (si hay al menos dos años).
- **Ranking por lugar** (si hay lugar): los 10 primeros por el indicador.
- **Mapa de calor lugar × periodo** (si hay fecha y lugar, con hasta 40 lugares).
- **Por categoría**: barras para cada categoría con entre 2 y 20 valores distintos (las de más
  valores muestran los 10 primeros más "Otros").
- **Distribución** de cada valor medido (histograma).
- Títulos en español armados por plantilla con los nombres de las columnas ("Hemoglobina
  promedio por distrito"), nunca por la IA.
- Filtros: selector de archivo (se elimina "Todos los archivos", porque mezclar temas distintos
  no tiene sentido) y año cuando hay fecha.

### 5. Predicción

- Pantalla Pronóstico generalizada: si hay fecha y al menos dos temporadas de historia en la
  granularidad elegida (semana: 52; mes: 12), se pronostica el indicador total con el modelo
  actual (naive estacional + deriva), con backtest y el mismo umbral de publicación (MASE < 1).
  Si no pasa, se muestra "todavía no hay un pronóstico confiable" con el motivo.
- La proyección anual a 5 años (ya existente) se ofrece para indicadores de suma o conteo cuando
  hay al menos un año completo. No aplica a promedios.
- El pronóstico por departamento actual sigue disponible dentro de la capa epidemiológica.

### 6. Navegación y pantallas existentes

| Pantalla                                  | Cuándo aparece                             |
| ----------------------------------------- | ------------------------------------------ |
| Tablero (nueva, reemplaza a Resumen)      | Siempre                                    |
| Análisis epidemiológico (actual Análisis) | Capa epidemiológica presente               |
| Pronóstico                                | Siempre; explica qué falta si no hay fecha |
| Recomendaciones y Explicación             | Capa epidemiológica presente               |
| Archivos                                  | Siempre                                    |

- Las pantallas que no aplican al dataset elegido se ocultan del menú; si se entra por URL,
  muestran un mensaje claro de por qué no hay datos, nunca un error.
- El aviso de recomendación que hoy está en Resumen pasa al Tablero cuando hay capa
  epidemiológica.

### 7. Textos y tema

- La marca pasa de "vigilancia de dengue" a "análisis de datos de salud", y el descargo de
  responsabilidad pasa a ser genérico.
- La enfermedad por defecto deja de ser DENGUE: se usa el tema del dataset.
- Las acciones recomendadas se separan en dos tablas revisadas: una de dengue (las actuales) y
  una general con redacción neutra (sin "criaderos"). La de dengue se usa cuando el tema es
  dengue.

### 8. Datos ya cargados

Una migración agrega las columnas y la tabla nuevas. Un comando de relleno vuelve a leer el
archivo original guardado de cada carga existente, deriva roles a partir de su mapeo actual y
llena `dataset_rows`, `columns`, `title` y `topic`. La capa epidemiológica ya existente no se
toca.

### 9. Verificación

- Unitarios: perfilado de columnas, validación de roles, reglas de cada widget (aparece / no
  aparece), granularidad y predicción genérica.
- Paridad: los snapshots actuales de ingesta y análisis de dengue no cambian.
- End-to-end contra PostgreSQL: un dataset tipo anemia sin fecha (tablero sin widgets de tiempo
  ni predicción, sin errores), el listado de egresos (con tiempo, lugar y capa epidemiológica) y
  el demo de dengue.
- Revisión visual en el navegador (claro, oscuro y móvil) con los archivos reales del usuario.

## Decisiones tomadas tras la revisión (criterio del diseñador, corregibles)

1. **Cómo se alimenta la capa epidemiológica.** Se reutiliza el pipeline actual (`normalize.ts`),
   alimentado con un mapeo derivado de los roles: fecha → `event_date`, año/semana →
   `year`/`epi_week`, lugar según su nivel → `department`/`province`/`district`/`location`/`ubigeo`,
   cantidad → `cases`. Para los campos que el rol genérico no distingue (sexo, edad, unidad de
   edad, diagnóstico, tipo de diagnóstico, DIRESA, enfermedad) se guarda en `columns` una
   etiqueta interna opcional `field`, sugerida por las reglas de alias actuales y por la IA, que
   el modal no muestra. Así un archivo de dengue produce exactamente el mismo mapeo que hoy y la
   paridad se mantiene.
2. **El tiempo no es solo "fecha".** Cuenta como tiempo: una fecha, o año + semana, o año + mes.
   Con solo año, se muestran únicamente los widgets anuales (comparación entre años, proyección
   anual). "Si hay fecha" en las secciones 4–6 significa "si hay tiempo" en este sentido.
3. **Identificadores y datos personales.** La lista actual de datos personales (DNI, nombre,
   historia clínica, teléfono…) sigue rechazando el archivo, y el usuario no puede saltarse esa
   regla eligiendo "Identificador". El rol Identificador es para códigos que no están en esa
   lista (por ejemplo `Id`, `codigo_registro`): no se guardan en `dataset_rows` ni se envían a la
   IA. El ejemplo `nro_historia` de la tabla de roles queda reemplazado por `codigo_registro`.
4. **Fuente (`source`).** El usuario ya no elige una fuente. El YAML `minsa_dengue` pasa a ser el
   conjunto de reglas de alias para sugerir roles y campos internos. `count_rows` desaparece: sin
   columna de cantidad, cada fila vale 1. La API conserva el parámetro `source` con su valor por
   defecto solo por compatibilidad, y el cuerpo de la carga envía los roles confirmados
   (`columns`), además del `mapping` derivado.
5. **"Todos los archivos".** Se quita de la interfaz, que siempre envía un archivo. Los endpoints
   epidemiológicos conservan el modo sin `upload_id` para no romper la paridad ni la exportación.
6. **Pronóstico de promedios.** El pronóstico de corto plazo se aplica a cualquier indicador
   (conteo, suma o promedio) con el mismo backtest y umbral de MASE. La proyección a 5 años
   queda solo para conteos y sumas.

## Alertas, anomalías y recomendaciones para cualquier dataset (decidido por el usuario)

Las pestañas de Análisis, Recomendaciones y Explicación se activan para cualquier dataset que
tenga tiempo, y se adaptan a lo que trae:

- **Anomalías:** se buscan sobre el indicador elegido (conteo, suma o promedio), por lugar si hay
  lugar o sobre el total si no lo hay, comparando cada periodo con lo habitual de esos mismos
  datos (método actual de desvío robusto). En conteos y sumas importa sobre todo lo que sube; en
  promedios, que suba o baje (por ejemplo, la hemoglobina promedio que cae).
- **Alertas:** el nivel (alta, atención, estable) sale de las mismas reglas deterministas de hoy,
  aplicadas al indicador y a la granularidad del dataset, y se redactan con los nombres de las
  columnas ("Hemoglobina promedio en baja en Junín: 11,2 → 10,4").
- **Recomendaciones:** el nivel y las anomalías siempre los decide el sistema. Las acciones:
  - Si el tema es dengue, salen de la tabla revisada actual.
  - En cualquier otro tema, la IA propone hasta 2 acciones por alerta. Solo recibe los hechos
    detectados (indicador, lugar, periodo, magnitud y tema), nunca filas. Cada acción se muestra
    marcada como "Sugerida por IA, revisar con el equipo".
  - Sin IA, se muestran acciones genéricas neutras ("Verificar la calidad del registro en esa
    zona", "Revisar el caso con el equipo responsable").
- **Explicación:** los factores se calculan sobre la serie del indicador (tendencia, estación,
  nivel reciente) con el método actual, y la narrativa usa los nombres de las columnas.
- Esto amplía la regla del proyecto "la IA redacta, nunca decide": las cifras, las alertas y las
  anomalías siguen siendo deterministas; la IA solo propone acciones fuera del dengue, siempre
  marcadas como sugerencia.

## Lo que queda a criterio de quien lo construya

- Consultas SQL sobre `jsonb` y, si el rendimiento lo exige con archivos grandes, columnas
  tipadas o vistas materializadas.
- Umbrales finos (valores distintos para "categoría", cantidad de barras, intervalos del
  histograma) dentro de los rangos indicados.
- Diseño visual de cada widget, reutilizando el sistema de diseño actual.
- Orden exacto de los widgets en el tablero.
