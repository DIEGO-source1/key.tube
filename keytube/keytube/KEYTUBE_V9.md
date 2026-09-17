# KeyTube V9 — detección Unlock corregida

## Qué corrige
- Los Locks existentes ya no se rechazan por depender del registro `locks()` de un factory específico de Unlock.
- KeyTube valida el contrato por bytecode y por la interfaz real de PublicLock (`publicLockVersion`, `name`, `keyPrice`, `expirationDuration`, `tokenAddress`).
- Añade varios RPC públicos por red para reducir fallos temporales de proveedor.
- Si MetaMask está conectado a una red compatible, esa red se prueba primero.
- Si no se puede leer el Lock, el mensaje incluye un diagnóstico por red en lugar de ocultar el error.

## Caso comprobado visualmente
El Lock `0xc4d22c0856eba8114b92e65a9aa1930e2e950ca2` aparece en Unlock Dashboard en Sepolia (11155111), con precio 0.002 ETH y duración de 30 días. V9 está preparada para priorizar Sepolia cuando MetaMask esté en esa red.
