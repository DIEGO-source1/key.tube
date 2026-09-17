# KeyTube V7 — perfil editable + Unlock más robusto

Esta versión corrige dos puntos:

1. **Perfil editable de verdad**
   - Cambiar nombre público.
   - Editar biografía.
   - Subir foto propia JPG/PNG/WEBP (máx. 5 MB).
   - Quitar la foto y volver a iniciales.
   - La foto se guarda en el almacenamiento Neon ya existente.
   - No requiere migración SQL nueva.

2. **Vincular Lock de Unlock**
   - Al vincular un Lock existente, KeyTube detecta automáticamente si está en Base Sepolia, Sepolia, Base o Polygon.
   - Lee el precio y duración reales del contrato.
   - Ya no obliga al creador a adivinar la red o copiar manualmente esos valores.
   - Muestra errores específicos si la wallet no es Lock Manager, si el Lock usa otra moneda, o si la duración no es compatible.
   - La validación de un Lock importado consulta el factory reportado por el propio PublicLock, para tolerar Locks creados con distintas versiones del factory de Unlock.

## Deploy

Reemplaza la carpeta `keytube` de tu repositorio por la de este ZIP y ejecuta:

```powershell
git add .
git commit -m "KeyTube V7 perfil editable y Unlock"
git push origin main
```

No cambies `DATABASE_URL` ni la configuración de Vercel que ya funciona.

## Perfil

Después del deploy:

`Mi cuenta` → `Elegir foto` → cambia nombre/biografía → `Guardar cambios del perfil`.

## Lock existente

`Mis planes` → marca `Ya tengo un Lock y quiero vincularlo` → pega la dirección → pulsa `Detectar datos del Lock`.

KeyTube mostrará la red, precio y duración detectados. Luego pulsa `Vincular Lock` y firma el mensaje en MetaMask.
