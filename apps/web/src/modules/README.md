# Módulos de la web

Cada carpeta de este directorio es una página real del sistema. Las rutas de
Next (`apps/web/app`) solo importan el componente público de la página y lo
renderizan dentro del layout del tablero.

## Estructura de una página

- `components/`: componentes exclusivos de la página.
- `services/`: llamadas HTTP a la API con axios, sin estado.
- `hooks/`: hooks de TanStack Query (`useQuery` / `useMutation`) y de interfaz.
- `constants/`: constantes exclusivas.
- `utils/`: funciones puras exclusivas.
- `index.ts`: API pública del módulo.

Solo se crean las carpetas que la página necesita.

## Compartido

`shared/` contiene lo que usan dos o más páginas o el layout del tablero:

- `api/`: cliente axios, token y `QueryClient`.
- `components/`: UI, gráficos, proyección anual (`outlook/`) y layout (barra lateral, topbar,
  modal de revisión de columnas).
- `constants/`: navegación, etiquetas, claves de consulta y arreglos vacíos.
- `contexts/`: filtros activos (archivo, año e indicador) compartidos con cada página.
- `hooks/`: tema, token, año, indicador (`useIndicatorInfo`), refresco y consultas/mutaciones
  compartidas.
- `services/`: llamadas HTTP compartidas.
- `utils/`: formato y tema.

Regla: si algo se usa en una sola página, vive en esa página; si se usa en más
de una (o en el layout), vive en `shared/`.

## Capas

1. `services/*.service.ts`: funciones con axios (`apiGet`, `apiPost`, `apiDelete`).
2. `hooks/*.ts`: `useQuery` / `useMutation` que consumen esos servicios.
3. `components/*.tsx`: interfaz; no llaman a la API directamente.

## Convenciones de TanStack Query

- Las claves viven en `shared/constants/query-keys.ts`; nunca se escriben a mano.
- Una consulta que depende de un dato aún no disponible usa `skipToken`, no un
  valor inventado (ver `useHeatmap`).
- Las mutaciones invalidan la caché en el propio hook (`onSuccess` devuelve la
  promesa para que `isPending` cubra el refresco); el componente solo maneja su
  estado de interfaz en el `mutate(..., { onSuccess })`.
- El layout resuelve la carga, el error y el estado vacío de `useUploads`; las
  páginas no los repiten.
- `'use client'` va solo en componentes con hooks o APIs del navegador, nunca en
  archivos de hooks.

## Rutas

| Ruta               | Página            |
| ------------------ | ----------------- |
| `/`                | `tablero`         |
| `/recomendaciones` | `recomendaciones` |
| `/analisis`        | `analisis`        |
| `/pronostico`      | `pronostico`      |
| `/explicacion`     | `explicacion`     |
| `/archivos`        | `archivos`        |

## Páginas que se adaptan al archivo

Cada archivo trae sus propias columnas, así que el menú solo muestra lo que el archivo
permite (`isAvailable` en `shared/constants/navigation.ts`):

- Tablero, Pronóstico y Archivos: siempre.
- Recomendaciones, Análisis y Explicación: cuando el archivo tiene fechas o año y semana.

Las páginas leen el indicador elegido (registros, total o promedio) de los filtros y lo
envían a la API; los textos usan `useIndicatorInfo()` en lugar de decir "casos" fijo.
