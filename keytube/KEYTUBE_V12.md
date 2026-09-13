# KeyTube V12

Corrección de compilación para Vercel Blob privado con `@vercel/blob` 2.8.0.

## Cambio

En `lib/media.ts`, la llamada a `presignUrl()` ahora declara explícitamente:

```ts
access: "private"
```

Esto coincide con el tipo requerido por la versión actual del SDK y con el Blob Store privado usado por KeyTube.

No requiere cambios SQL ni cambios adicionales en Vercel. Conserva `DATABASE_URL` y las variables `BLOB_*` existentes.
