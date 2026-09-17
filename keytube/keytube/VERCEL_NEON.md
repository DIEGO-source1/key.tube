# KeyTube en Vercel + Neon

Esta variante usa Next.js nativo en Vercel y Neon PostgreSQL.

## 1. Neon

1. Abre el SQL Editor de tu proyecto Neon.
2. Ejecuta todo el archivo `neon/001_init.sql` una sola vez.
3. Copia la conexión pooled de Neon.

## 2. Variables de Vercel

Crea `DATABASE_URL` como Secret para Production, Preview y Development.

Opcionales para Google OAuth:
- `APP_ORIGIN=https://TU-PROYECTO.vercel.app`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## 3. Ajustes de Build en Vercel

- Framework Preset: `Next.js`
- Root Directory: `keytube`
- Build Command: `pnpm build`
- Output Directory: dejar en `Next.js default` (sin Override)
- Install Command: `pnpm install --no-frozen-lockfile`

El `--no-frozen-lockfile` es necesario en el primer deploy de esta variante porque se añadió `@neondatabase/serverless` al `package.json`. Después de que ejecutes `pnpm install` en tu PC y subas el `pnpm-lock.yaml` actualizado, puedes volver a `pnpm install`.

## 4. Archivos multimedia

Para que el proyecto funcione sin Cloudflare R2, esta variante guarda los archivos de hasta 20 MB en una tabla `media_objects` de Neon. Esto consume el almacenamiento de tu plan de Neon. Para producción con muchos videos conviene migrar luego los archivos a Vercel Blob, S3 o R2.

## 5. Deploy

Haz un Redeploy sin cache. El build correcto debe mostrar `next build`, no `vinext build`.
