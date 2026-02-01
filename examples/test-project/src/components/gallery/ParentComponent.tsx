import React from 'react'
import Item from './__private__/Item'

// ESTE ARCHIVO DEBE PODER IMPORTAR DESDE __private__
// CASO 2: Archivo hermano puede importar desde __private__

// import PrivateItem from '@/components/gallery'

export default function ParentComponent() {
  return (
    <div>
      <Item />
      <h1>Parent Component</h1>
    </div>
  )
}
