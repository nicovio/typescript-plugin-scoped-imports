import React from "react";

// PRUEBAS REALIZAR:
// 1. Escribir: Item (debería dar error "Cannot find name 'Item'")
// 2. Usar Ctrl+. o lightbulb sobre el error
// 3. NO debería aparecer opción para importar desde __private__
// 4. Verificar logs de bloqueo en Output → TypeScript
//
// 5. Escribir: import Item from './' o '@/'
// 6. NO debería aparecer sugerencias de __private__ items
//
// 7. Intentar: Organize Imports (Shift+Alt+O)
// 8. NO debería agregar imports de __private__

// Variable no definida para forzar error de auto-import

export default function Home() {
  return (
    <>
      <div>
        <h1>Home</h1>
        <p>Este componente NO debería poder importar Item de __private__/</p>
        <p>
          Prueba escribiendo "Item" o "SomeUndefinedComponent" y usando Ctrl+.
        </p>
      </div>
    </>
  );
}
