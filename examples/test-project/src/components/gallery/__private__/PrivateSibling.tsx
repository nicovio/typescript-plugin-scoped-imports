import React from 'react'
import Item from '@/components/gallery//ParentComponent'

// ESTE ARCHIVO DEBE PODER IMPORTAR DESDE __private__
// CASO 1: Archivo dentro de __private__ puede importar otros archivos de __private__

export default function PrivateSibling() {
  return (
    <div>
      <Item />
      <h1>Private Sibling Component</h1>
    </div>
  )
}
