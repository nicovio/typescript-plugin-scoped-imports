# TypeScript Plugin Scoped Imports (VS Code)

Extension wrapper para cargar `typescript-plugin-scoped-imports` en VS Code sin depender de seleccionar manualmente "Use Workspace Version".

## Que hace

Registra el plugin de `tsserver` usando `typescriptServerPlugins`, para que VS Code lo cargue desde la extension.

## Instalacion (usuario)

1. Instala la extension desde Marketplace.
2. Asegurate de tener configurado el plugin en `tsconfig.json` del proyecto:

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

## Verificacion

1. Ejecuta `TypeScript: Open TS Server log`.
2. Busca: `PLUGIN LOADING: typescript-plugin-scoped-imports`.

## Troubleshooting

Si no carga:

- recarga VS Code (`Developer: Reload Window`)
- confirma que el proyecto tenga `tsconfig.json` valido
- revisa que el log no muestre errores de carga del plugin

## Para mantenedores (publicacion)

Desde esta carpeta:

```bash
npm install
npm run package
```

Esto genera un `.vsix` autocontenido (incluye el plugin sincronizado en `plugin/`).

Publicar en Marketplace:

```bash
npx vsce login nicovio
npm run publish:vsce
```
