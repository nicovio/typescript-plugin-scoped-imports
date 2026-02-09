# TypeScript Plugin: Scoped Imports

TypeScript Language Server plugin para controlar auto-imports basado en el scope del archivo.

## Estado actual

Regla validada en esta fase:

- `__private__` es accesible desde su carpeta padre y subdirectorios.
- Fuera de ese subtree, el plugin bloquea sugerencias y fixes que introduzcan imports privados.

## Instalacion (workspace)

```bash
pnpm install
pnpm run build
```

Requiere Node.js 24 LTS.

## Configuracion

En tu `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "typescript-plugin-scoped-imports"
      }
    ]
  }
}
```

Convencion: el plugin considera privados los paths que contengan la carpeta `__private__`.

## Matriz de validacion

La suite automatizada vive en:

- `packages/typescript-plugin-scoped-imports/__tests__/integration/tsserver.scoped-imports.spec.ts`

| Caso | Esperado | Resultado |
| --- | --- | --- |
| Carga del plugin en tsserver | Debe loguear `PLUGIN LOADING` | Automatizado |
| Path completion out-of-scope (`Home.tsx` + `@/components/gallery/`) | No sugerir `__private__` | Automatizado |
| Path completion in-scope padre (`ParentComponent.tsx` + `./`) | Sugerir `__private__` | Automatizado |
| Path completion in-scope descendiente (`silbing/index.tsx` + `../`) | Sugerir `__private__` | Automatizado |
| Path completion out-of-scope lateral (`UtilsComponent.tsx` + `../gallery/`) | No sugerir `__private__` | Automatizado |
| CodeFix missing import out-of-scope (`Home.tsx`) | No proponer imports privados | Automatizado |
| CodeFix missing import in-scope padre (`ParentComponent.tsx`) | Proponer import privado valido | Automatizado |
| CodeFix missing import in-scope descendiente (`silbing/nephew/index.tsx`) | Proponer import privado valido | Automatizado |
| Combined fix out-of-scope (`fixMissingImport`) | Sin cambios con `__private__` | Automatizado |
| Combined fix in-scope (`fixMissingImport`) | Con cambios privados validos | Automatizado |
| `getCompletionEntryDetails` bloqueado | Respuesta vacia y log de bloqueo | Automatizado |
| `getEditsForRefactor` smoke | No romper flujo ni introducir `__private__` fuera de scope | Automatizado |
| Riesgo alias por nombre repetido (`views/gallery/ScopeTrap.tsx`) | No filtrar incorrectamente por coincidencia de nombre | Gap detectado |

## Ejecutar validacion automatizada

Desde la raiz del workspace:

```bash
pnpm run build
pnpm run test
```

## Gaps detectados (priorizados)

1. `P1` Heuristica de alias por nombre de carpeta puede permitir imports privados fuera de scope cuando se usa `importModuleSpecifierPreference: \"non-relative\"`.
   - Reproduccion: archivo `src/views/gallery/ScopeTrap.tsx`, quick-fix de `Item` propone `@/components/gallery/__private__/Item`.
   - Causa probable: la validacion de alias en `isPrivateImportAllowed` usa coincidencia por nombre de carpeta (`/gallery/`) en vez de resolver ruta canonica del modulo.
   - Mitigacion propuesta: resolver el specifier via TypeScript module resolution y comparar paths absolutos normalizados contra el subtree real del `__private__` objetivo.

## Uso en proyecto de prueba

Ver `examples/test-project/` en la raiz del workspace para un ejemplo de consumo real.

## Roadmap

- [x] Fase 1: POC y validacion de carga
- [x] Validacion integral de casos de completions y codefixes
- [ ] Fase 2: Reglas contextuales adicionales
- [ ] Fase 3: Configuracion flexible
- [ ] Fase 4: Distribucion y documentacion completa
