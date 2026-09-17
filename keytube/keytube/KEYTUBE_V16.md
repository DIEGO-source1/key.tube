# KeyTube V16 — móvil, multi-dispositivo y wallet opcional

Esta versión está preparada para que la experiencia normal de KeyTube funcione en navegador de escritorio, tablet y móvil sin exigir MetaMask.

## Cambios principales

- La navegación, registro, inicio de sesión, edición de perfil y subida de contenido no conectan MetaMask automáticamente.
- Publicar contenido para miembros ya no pide una firma de wallet en cada publicación. KeyTube reutiliza el plan Unlock que el creador ya verificó al vincularlo.
- Comprar una membresía abre Unlock directamente; KeyTube no pide una wallet antes de abrir el checkout.
- La wallet se solicita solamente para acciones Web3 explícitas: crear/modificar planes Unlock o verificar que una wallet posee una membresía.
- Subidas completas de hasta 500 MB siguen yendo directamente del navegador a Vercel Blob privado.
- Para mejorar la estabilidad en móvil, los archivos mayores de 8 MB usan carga multipart.
- Se aceptan más formatos móviles: MOV/M4V además de MP4/WebM y M4A/AAC además de MP3/WAV/OGG.
- Fotos de perfil y portadas se optimizan en el navegador antes de subirlas, reduciendo problemas con fotos grandes tomadas por el teléfono.
- El generador de adelantos intenta MP4 en navegadores compatibles y WebM como alternativa.
- Si un móvil no puede generar el adelanto de 10 segundos, la publicación ya no se bloquea: el archivo completo queda protegido y se publica usando portada/introducción como vista previa.
- Diseño móvil mejorado: campos a 16 px, botones táctiles más grandes, formulario en una columna y soporte de safe areas.
- Se agregó manifest y configuración de viewport para una mejor experiencia al abrir KeyTube desde teléfonos y al añadirlo a la pantalla de inicio.

## Importante sobre la wallet

KeyTube puede abrirse y usarse sin wallet. Unlock sigue siendo Web3, por lo que una wallet compatible continúa siendo necesaria únicamente cuando el usuario decide hacer una operación blockchain o demostrar que posee una Key/membresía.

## Vercel

Conserva las variables ya configuradas:

- `DATABASE_URL`
- `BLOB_READ_WRITE_TOKEN`
- `BLOB_STORE_ID`
- `BLOB_WEBHOOK_PUBLIC_KEY`

No requiere migración SQL adicional.
