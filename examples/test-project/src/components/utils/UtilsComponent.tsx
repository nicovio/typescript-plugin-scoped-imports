import React from "react";

export default function UtilsComponent() {
  return (
    <div>
      <h1>Utils Component</h1>
      <p>Prueba escribiendo: import Test from '../gallery/__private__/'</p>
      <p>NO debería ver: ❌ (utils no es hermano de gallery)</p>
    </div>
  );
}
