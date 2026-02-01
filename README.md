# TypeScript Plugin: Scoped Imports

TypeScript Language Server plugin para controlar auto-imports basado en el scope del archivo.

## Estado: POC (Fase 1)

Esta es la versión POC (Proof of Concept) del plugin. Actualmente:

- ✅ Carga correctamente en el TypeScript Language Server
- ✅ Bloquea TODOS los auto-imports de archivos en carpetas `__private__/`
- ⏳ Fase 2 implementará lógica contextual "parent-only"

## Instalación (POC)

```bash
pnpm install
pnpm run build
```

Nota: si cambias dependencias en `package.json`, corre `pnpm install` y commitea `pnpm-lock.yaml`.
En CI se usa `pnpm install --frozen-lockfile` para garantizar consistencia.

## Uso en proyecto de prueba

Ver `examples/test-project/` para un ejemplo de cómo configurar el plugin.

## Configuración

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
No hay configuracion de patrones en esta version.

## Testing

1. Build el plugin: `pnpm run build`
2. Abre `examples/test-project` en VSCode
3. Recarga VSCode (Cmd+Shift+P → "Reload Window")
4. Verifica logs en Output → TypeScript
5. Prueba auto-import en archivos de test

## Roadmap

- [x] Fase 1: POC - Validar que el plugin funciona
- [ ] Fase 2: Reglas contextuales (parent-only)
- [ ] Fase 3: Configuración flexible
- [ ] Fase 4: Distribución y documentación completa

## Logs de Debugging

Para ver los logs del plugin:

1. VSCode → Output panel (Cmd+Shift+U)
2. Selecciona "TypeScript" en el dropdown
3. Busca mensajes con prefijo `typescript-plugin-scoped-imports:`
