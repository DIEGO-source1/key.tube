# KeyTube V11

Corrección del flujo de wallet para varias cuentas de KeyTube en el mismo navegador.

- Al vincular o cambiar wallet, KeyTube vuelve a abrir el selector de cuentas de MetaMask cuando el proveedor lo permite.
- Un segundo usuario ya no hereda silenciosamente la wallet del usuario anterior.
- Una misma wallet no puede quedar vinculada a dos perfiles de KeyTube.
- Si la wallet ya pertenece a otra cuenta, se muestra un mensaje claro para cambiar de cuenta o desvincularla primero.
- No requiere cambios de esquema ni SQL nuevo.
