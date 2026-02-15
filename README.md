# typescript-plugin-scoped-imports

Monorepo del plugin `typescript-plugin-scoped-imports` y su wrapper para VS Code.

## Paquetes

- `packages/typescript-plugin-scoped-imports`: plugin de TypeScript (`tsserver`)
- `packages/typescript-plugin-scoped-imports-vscode`: extension wrapper para cargar el plugin en VS Code sin depender de "Use Workspace Version"
- `examples/test-project`: fixture de validacion manual e integracion

## Que problema resuelve

Controla sugerencias de auto-import para evitar que archivos fuera de scope importen modulos ubicados en carpetas `__private__`.

Regla actual:

- In-scope: carpeta padre de `__private__` y todos sus descendientes.
- Out-of-scope: cualquier archivo fuera de ese subtree.

## Quick start (desarrollo)

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm run test
```

## Documentacion

- Plugin: `packages/typescript-plugin-scoped-imports/README.md`
- Extension VS Code: `packages/typescript-plugin-scoped-imports-vscode/README.md`
- Release checklist: `RELEASING.md`
