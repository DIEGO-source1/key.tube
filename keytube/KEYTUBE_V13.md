# KeyTube V13

## Wallet corregida

Esta versión mejora la detección de wallets del navegador:

- Detecta MetaMask mediante EIP-6963.
- Mantiene compatibilidad con `window.ethereum` y `ethereum.providers`.
- Espera brevemente por extensiones que se inyectan después de cargar la página.
- Para un segundo usuario de KeyTube, vuelve a solicitar el selector de cuentas de MetaMask.
- Firma y lectura de red usan el mismo provider seleccionado, evitando mezclar MetaMask con otra wallet instalada.
- Si Chrome bloquea la extensión en el dominio, muestra instrucciones concretas para habilitar el acceso al sitio.

No requiere cambios SQL ni nuevas variables de entorno.
