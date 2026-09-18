# README — KeyTube V7

## Qué cambia en esta versión

KeyTube diferencia claramente contenido **Gratis** y **Solo miembros**.

### Contenido Gratis

- **Imagen:** se muestra la imagen original completa, sin pixelado.
- **Video:** se reproduce automáticamente cuando aparece en el feed, en silencio para cumplir las reglas de Chrome/Safari. Al abrir la publicación sigue siendo el video completo y el usuario puede activar el sonido.
- **Audio/canción:** al abrir la publicación KeyTube intenta reproducir automáticamente la canción completa. Algunos navegadores bloquean audio con sonido hasta el primer clic/toque; si ocurre, KeyTube vuelve a intentar al primer gesto del usuario.
- **Documento:** se muestra el documento completo.
- **Texto:** se muestra el artículo completo al abrirlo.

### Contenido de pago

- **Imagen:** vista pública fuertemente pixelada; original solo después de validar la membresía.
- **Video:** adelanto de ~10 segundos y luego bloqueo/pixelado.
- **Audio:** adelanto de ~10 segundos y luego se detiene.
- **Documento:** solo las primeras páginas elegidas por el creador (1 a 10).
- **Texto:** introducción pública y contenido completo protegido.

## Importante sobre autoplay

Los navegadores modernos permiten autoplay de video si está **silenciado**. Por eso los videos gratis comienzan solos pero sin sonido. El usuario puede desmutearlos.

El audio con sonido puede ser bloqueado por Chrome, Edge, Safari o Firefox hasta que el usuario haga una interacción. KeyTube intenta reproducirlo al cargar y vuelve a intentarlo automáticamente en el primer clic/toque/tecla. Esto es una restricción del navegador, no de KeyTube.

## Ejecutar localmente

1. Instala Node.js 22 o superior.
2. Instala pnpm:

```bash
npm install -g pnpm
```

3. Entra a la carpeta `keytube`:

```bash
cd keytube
```

4. Instala dependencias:

```bash
pnpm install --no-frozen-lockfile
```

5. Crea `.env.local` usando `.env.example` como referencia. Como mínimo configura `DATABASE_URL` y las variables que uses para Blob, Google y recuperación de correo.

6. Ejecuta:

```bash
pnpm dev
```

7. Abre:

```text
http://localhost:3000
```

## Subir a GitHub/Vercel

Después de reemplazar los archivos de tu proyecto por esta versión:

```bash
git add .
git commit -m "version7 contenido gratis automatico"
git push origin main
```

Vercel detectará el push y realizará un nuevo deployment.

No cambies `DATABASE_URL`, `APP_ORIGIN`, `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID` o `GOOGLE_CLIENT_SECRET` si ya están configuradas correctamente.
