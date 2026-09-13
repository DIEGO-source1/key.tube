# KeyTube V10 — archivos grandes y vista previa de 10 segundos

## Cambios
- Archivos completos de video, audio, imagen y documento: hasta **500 MB por archivo**.
- Cuota por creador: **5 GB**.
- Los archivos completos se suben directamente desde el navegador a **Vercel Blob privado**, usando multipart para archivos mayores a 100 MB.
- Adelantos y portadas siguen siendo pequeños y se mantienen separados del archivo completo.
- Videos exclusivos: adelanto gratuito de hasta 10 segundos; al terminar, el último cuadro se muestra pixelado y aparece el bloqueo de membresía.
- El archivo completo privado solo se entrega después de verificar acceso y mediante una URL firmada temporal.

## Requisito en Vercel
Antes de subir archivos grandes, crea y conecta un Blob Store privado:
1. Vercel → proyecto `key-tube` → Storage.
2. Create Database / Blob.
3. Selecciona **Private**.
4. Conecta el store a este proyecto y habilita Production/Preview.
5. Vercel añadirá `BLOB_READ_WRITE_TOKEN` automáticamente.
6. Haz un deployment nuevo.

`vercel.json` mantiene `pnpm install --no-frozen-lockfile`, por lo que Vercel instalará `@vercel/blob` aunque el lockfile previo todavía no lo contenga.
