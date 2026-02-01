# Test Project - TypeScript Plugin Scoped Imports

Proyecto de prueba para validar el funcionamiento del plugin.

## Setup

```bash
# Desde la raíz del plugin
pnpm install
pnpm run build
```

El ejemplo usa el workspace, no requiere `pnpm install` adicional en este directorio.

## Testing del POC (Fase 1)

### Objetivo

Convencion: el plugin considera privados los paths que contengan la carpeta `__private__`.

Validar que el plugin se carga correctamente y bloquea imports de `__private__/`.

### Pasos

1. **Abrir este proyecto en VSCode:**

   ```bash
   code .
   ```

2. **Recargar VSCode:**
   - Cmd+Shift+P → "Developer: Reload Window"

3. **Verificar que el plugin se cargó:**
   - Abrir Output panel (Cmd+Shift+U)
   - Seleccionar "TypeScript" en el dropdown
   - Buscar: `typescript-plugin-scoped-imports: Plugin loaded`

4. **Probar Auto-Import Bloqueado:**

   a. Abrir `src/views/ContentExplorer.tsx`
   b. Escribir en una nueva línea: `import Item from '@/`
   c. **Resultado esperado:** NO sugiere `@/components/gallery/__private__/Item`
   d. Verificar en logs: `typescript-plugin-scoped-imports: Blocked`

5. **Probar Auto-Import desde Gallery (Fase 1 - también bloqueado):**

   a. Abrir `src/components/gallery/Gallery.tsx`
   b. Escribir: `import Item from './`
   c. **Resultado esperado POC:** NO sugiere `__private__/Item` (porque bloquea TODO)
   d. **Resultado esperado Fase 2:** SÍ sugerirá `__private__/Item` (parent-only)

## Criterios de Éxito POC

- ✅ Plugin aparece en los logs de TypeScript
- ✅ Auto-import NO sugiere archivos de `__private__/` desde ContentExplorer
- ✅ Plugin filtra entries (ver logs con count de filtrados)

## Estructura de Archivos

```
src/
├── components/
│   └── gallery/
│       ├── Gallery.tsx              # Padre directo de __private__/
│       └── __private__/
│           └── Item/
│               └── index.tsx        # Componente privado
└── views/
    └── ContentExplorer.tsx          # NO debería poder importar Item
```

## Troubleshooting

### Plugin no se carga

- Verificar que `pnpm run build` completó sin errores en el directorio raíz
- Verificar que existe `../../dist/index.js`
- Recargar VSCode completamente

### No veo logs

- Asegurarte de estar en el panel "TypeScript" (no "Extension Host" ni otros)
- Intentar editar un archivo .tsx para forzar al TypeScript Server a activarse

### Auto-import sigue mostrando __private__/

- Verificar configuración en `tsconfig.json`
- Recargar VSCode
- Revisar logs para ver si hay errores
