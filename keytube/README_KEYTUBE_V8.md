# README — KeyTube V8

## Cambios de esta versión

- Se restauró el bloque **Tendencias** en la columna derecha. Ordena las publicaciones por número de vistas y muestra las 5 principales.
- El panel derecho (membresía, tendencias, creadores y acceso al estudio) **acompaña el desplazamiento** mientras recorres el feed en pantallas de escritorio.
- Los videos gratuitos se reproducen automáticamente y muestran un **botón visible para activar o silenciar el sonido**.
- El video conserva su **proporción original** (horizontal, vertical o cuadrado) en lugar de forzarse siempre a 16:9.
- Se quitaron las etiquetas flotantes de “vista previa / adelanto” sobre videos e imágenes.
- El contenido de pago mantiene la protección: imágenes pixeladas, video/audio limitado, documentos con páginas gratuitas y resto bloqueado.

## Importante sobre el sonido automático

Chrome, Edge, Safari y otros navegadores normalmente bloquean el autoplay con sonido. Por eso KeyTube inicia los videos gratuitos silenciados para que sí puedan arrancar automáticamente. El usuario puede tocar el botón de altavoz para activar el sonido inmediatamente.

## Ejecutar KeyTube localmente

1. Instala Node.js 22 o superior.
2. Instala pnpm:

```bash
npm install -g pnpm
```

3. Entra a la carpeta del proyecto:

```bash
cd keytube
```

4. Instala dependencias:

```bash
pnpm install --no-frozen-lockfile
```

5. Crea `.env.local` a partir de `.env.example` y configura las variables necesarias. Si ya las tienes en Vercel, no las publiques en GitHub.

Variables principales:

```text
DATABASE_URL=
APP_ORIGIN=
BLOB_READ_WRITE_TOKEN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
```

6. Ejecuta el proyecto:

```bash
pnpm dev
```

7. Abre en el navegador:

```text
http://localhost:3000
```

## Neon

No ejecutes `neon/003_reset_all_users_and_content.sql` en una base de producción porque reinicia datos.

Para recuperación de contraseña, la migración necesaria es:

```text
neon/004_password_recovery.sql
```

Si ya la ejecutaste anteriormente, no necesitas repetirla.

## Subir esta V8 a GitHub y Vercel

Reemplaza los archivos de tu proyecto con los de esta versión y, desde la carpeta del repositorio, ejecuta:

```bash
git add .
git commit -m "version8 tendencias sonido y video adaptable"
git push origin main
```

Vercel detectará el `push` y hará un nuevo deployment.

## Comprobación rápida después del deploy

- Abre Inicio y confirma que aparece **Tendencias** en la columna derecha.
- Baja por el feed y comprueba que la columna derecha acompaña el scroll.
- Sube un video gratuito horizontal y otro vertical: ambos deben mantener su proporción.
- El video gratuito debe comenzar silenciado y mostrar el botón de sonido.
- Revisa una imagen/video de pago para confirmar que el original sigue protegido.
- Comprueba que ya no aparecen etiquetas flotantes tipo “vista previa” sobre el contenido.
