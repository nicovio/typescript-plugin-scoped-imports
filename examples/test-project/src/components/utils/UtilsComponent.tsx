import React from "react";
import Item from '../gallery/__private__/Item'

// ESTE ARCHIVO DEBE PODER IMPORTAR DESDE __private__ DESDE UTILS
// CASO: Archivo en /src/components/utils puede importar desde /src/components/gallery/__private__
// Al escribir: import Item from '../gallery/' DEBERÍA aparecer __private__ y sus contenidos

export default function UtilsComponent() {
  return (
    <div>
      <h1>Utils Component</h1>
      <p>Prueba escribiendo: import Test from '../gallery/__private__/'</p>
      <p>NO debería ver: ❌ (utils no es hermano de gallery)</p>
    </div>
  );
}
