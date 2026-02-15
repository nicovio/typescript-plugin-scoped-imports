# typescript-plugin-scoped-imports

TypeScript Language Service plugin para filtrar auto-imports de carpetas privadas (`__private__`) segun el scope del archivo.

## Que hace

Cuando TypeScript propone imports (completions, quick fixes o refactors), este plugin bloquea imports desde `__private__` si el archivo actual esta fuera de scope.

Regla de scope actual:

- Permitido: carpeta padre de `__private__` y subdirectorios.
- Bloqueado: cualquier archivo fuera de ese subtree.

## Instalacion

```bash
npm i -D typescript
npm i typescript-plugin-scoped-imports
```

## Configuracion

En `tsconfig.json`:

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

## Ejemplo rapido

Estructura:

```text
src/components/gallery/__private__/Item.ts
src/components/gallery/silbing/nephew/InScope.ts
src/views/Home.ts
```

- En `InScope.ts`: se permite importar `Item` desde `__private__`.
- En `Home.ts`: se bloquea importar `Item` desde `__private__`.

## VS Code

Si usas solo el plugin npm, VS Code puede requerir usar TypeScript del workspace para cargarlo.

Si quieres evitar eso, usa la extension wrapper:

- `packages/typescript-plugin-scoped-imports-vscode`

## Compatibilidad

- Node.js: `>=20`
- TypeScript: `>=4.0.0`

## Troubleshooting

Si no parece cargar:

1. Abre `TypeScript: Open TS Server log`.
2. Busca `PLUGIN LOADING: typescript-plugin-scoped-imports`.
3. Si no aparece, revisa:
   - que el plugin este instalado en el proyecto
   - que `tsconfig.json` tenga la entrada en `compilerOptions.plugins`

## Limitaciones conocidas

- La convencion de privacidad es por nombre de carpeta `__private__`.
- No hay configuracion custom de patrones en esta version.

## Validacion automatizada

La cobertura principal vive en:

- `packages/typescript-plugin-scoped-imports/__tests__/integration/tsserver.scoped-imports.spec.ts`

Ejecutar:

```bash
pnpm run build
pnpm run test
```

## Changelog

Ver `CHANGELOG.md`.
