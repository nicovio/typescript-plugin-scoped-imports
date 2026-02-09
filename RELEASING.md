# Releasing `typescript-plugin-scoped-imports`

Checklist para publicar una nueva version del plugin.

## 1) Preflight

Desde la raiz del workspace:

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm run test
```

## 2) Definir version y changelog

1. Elegir `patch`, `minor` o `major`.
2. Actualizar `packages/typescript-plugin-scoped-imports/package.json` (`version`).
3. Crear entrada de changelog (o notas de release en PR).

## 3) Verificar contenido publicable

Empaquetar localmente y revisar el tarball:

```bash
pnpm --filter typescript-plugin-scoped-imports pack
tar -tf packages/typescript-plugin-scoped-imports/typescript-plugin-scoped-imports-*.tgz
```

## 4) Smoke test en proyecto externo

1. Crear un proyecto TypeScript fuera del monorepo.
2. Instalar el tarball generado.
3. Agregar plugin en `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "typescript-plugin-scoped-imports" }]
  }
}
```

4. Abrir en VSCode y confirmar en TS Server log:
   - carga del plugin (`PLUGIN LOADING`)
   - filtrado correcto de imports `__private__` para in-scope/out-of-scope.

## 5) Publicar

Autenticado en npm:

```bash
pnpm --filter typescript-plugin-scoped-imports publish --access public
```

Si usas tags:

```bash
pnpm --filter typescript-plugin-scoped-imports publish --access public --tag next
```

## 6) Post-release

1. Crear release/tag en GitHub.
2. Publicar notas de cambios.
3. Verificar instalacion desde npm en un proyecto limpio.
