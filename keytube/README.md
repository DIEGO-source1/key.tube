# KeyTube — instalación completa y ejecución

KeyTube es una aplicación Next.js para publicar contenido gratuito o protegido por membresía. Esta versión incluye inicio con Google, recuperación de contraseña por correo, almacenamiento privado, planes con Unlock y adelantos protegidos para video, audio, imágenes y documentos.

## 1. Qué hace esta versión

- **Videos de pago:** genera un adelanto independiente de aproximadamente 10 segundos. El archivo completo queda privado.
- **Canciones / audio de pago:** genera un adelanto independiente de aproximadamente 10 segundos. El audio completo queda privado.
- **Imágenes de pago:** crea una copia pública fuertemente pixelada. La imagen original queda privada y solo se entrega después de verificar la membresía.
- **Documentos de pago:** el creador elige entre **1 y 10 páginas gratuitas**. Para PDF se crea un PDF nuevo que contiene únicamente esas primeras páginas; el PDF original queda privado. Para TXT se crea una muestra equivalente.
- **Artículos de texto de pago:** solo la introducción es pública; el cuerpo completo se entrega después de verificar acceso.
- **Cuenta:** registro por correo, recuperación por código de 6 dígitos y acceso con Google.

> Importante: el adelanto y el archivo completo son archivos distintos. Esto evita que alguien obtenga el original simplemente inspeccionando la URL de la vista previa.

## 2. Requisitos

- Node.js 22 o superior.
- pnpm 11.25.0.
- Una base PostgreSQL en Neon.
- Un proyecto en Vercel.
- Vercel Blob para archivos completos.
- Una cuenta de Google Cloud para OAuth.
- Resend para enviar códigos de recuperación.
- MetaMask y Unlock Protocol si usarás contenido de pago.

## 3. Instalar localmente

Desde la carpeta `keytube`:

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --no-frozen-lockfile
```

Luego crea un archivo `.env.local` usando `.env.example` como guía.

Variables principales:

```env
DATABASE_URL=postgresql://...
APP_ORIGIN=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
RESEND_API_KEY=...
EMAIL_FROM=KeyTube <cuentas@tudominio.com>
BLOB_READ_WRITE_TOKEN=...
```

No publiques secretos en GitHub.

## 4. Preparar Neon

En Neon abre **SQL Editor**. Ejecuta las migraciones necesarias en orden. Si tu base ya tiene KeyTube funcionando, no ejecutes scripts de reinicio.

Para recuperación de contraseña debe existir la tabla `password_recovery_codes`. Puedes ejecutar `neon/004_password_recovery.sql`.

**No ejecutes** `neon/003_reset_all_users_and_content.sql` en una base con datos reales, porque está destinado a reinicios de desarrollo.

## 5. Ejecutar en desarrollo

```bash
pnpm dev
```

Abre:

```text
http://localhost:3000
```

Para compilar:

```bash
pnpm build
```

Para arrancar la compilación de producción:

```bash
pnpm start
```

## 6. Configurar Vercel

En **Vercel → Project → Settings → Environment Variables** configura como mínimo:

- `DATABASE_URL`
- `APP_ORIGIN` — por ejemplo `https://key-tube.vercel.app`
- `BLOB_READ_WRITE_TOKEN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Después haz un nuevo deployment. Las variables nuevas no se aplican retroactivamente a deployments antiguos.

El archivo `.vercelignore` ya evita que Vercel compile respaldos y carpetas auxiliares.

## 7. Google Login

En Google Cloud crea un cliente OAuth de tipo **Web application**.

Origen autorizado:

```text
https://TU-DOMINIO
```

Redirect URI:

```text
https://TU-DOMINIO/api/auth/google/callback
```

Ejemplo:

```text
https://key-tube.vercel.app/api/auth/google/callback
```

Copia el Client ID y Client Secret a Vercel.

## 8. Recuperación de contraseña

Configura Resend con:

```env
RESEND_API_KEY=re_...
EMAIL_FROM=KeyTube <cuentas@tudominio.com>
```

El usuario recibe un código de 6 dígitos que expira en 10 minutos. El sistema limita intentos y no guarda el código en texto plano.

## 9. Publicar contenido gratuito

En **Mi estudio → Publicar**:

1. Elige Video, Audio, Imagen, Documento o Texto.
2. Sube el archivo.
3. Selecciona `Gratis · contenido completo`.
4. Publica.

Los usuarios podrán abrir el archivo completo sin pagar.

## 10. Publicar contenido de pago

Primero crea un plan en **Mis planes** y conecta su Lock de Unlock. Después, al publicar, selecciona ese plan en **Acceso**.

### Video

KeyTube crea automáticamente un adelanto de unos 10 segundos. El archivo original de hasta 500 MB se guarda de forma privada.

### Audio / canciones

KeyTube crea automáticamente un adelanto de unos 10 segundos. Al terminar, el usuario ve la opción de membresía.

### Imagen

KeyTube crea una versión reducida y fuertemente pixelada. La original no se usa como preview pública.

### Documento PDF/TXT

Aparecerá el campo **Páginas gratuitas del documento**. Elige entre 1 y 10.

- PDF: se genera un PDF nuevo solo con las primeras N páginas.
- TXT: se genera una muestra de texto equivalente a N páginas aproximadas.
- El original completo sigue en almacenamiento privado.

### Texto / artículo

La introducción es pública. El cuerpo completo solo se devuelve después de verificar la membresía.

## 11. Flujo de desbloqueo

1. El visitante ve el adelanto.
2. Compra una membresía mediante Unlock.
3. Vuelve a KeyTube.
4. Pulsa **Ya tengo membresía · verificar acceso**.
5. Firma con la wallet que recibió la membresía.
6. KeyTube comprueba el Lock y entrega un enlace temporal al archivo completo.

El enlace temporal al archivo completo caduca; no es la URL pública del archivo.

## 12. Subir cambios a GitHub

Desde tu carpeta del proyecto:

```bash
git add .
git commit -m "keytube previews protegidos"
git push origin main
```

Vercel debería detectar el push y desplegar automáticamente.

Los avisos de Windows como `LF will be replaced by CRLF` son advertencias de finales de línea de Git y no significan que el build haya fallado.

## 13. Si Vercel falla

Busca al final del log desde:

```text
Running TypeScript ...
```

o desde:

```text
Creating an optimized production build ...
```

Los warnings de paquetes deprecated no suelen ser la causa principal. El error real normalmente aparece en las últimas líneas.

## 14. Seguridad importante

- Nunca guardes `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `DATABASE_URL` ni tokens de Blob en GitHub.
- Los previews de pago deben ser archivos derivados, nunca el archivo original servido con CSS borroso.
- Las imágenes de pago usan una copia pixelada.
- Los documentos de pago usan un archivo separado con solo las páginas gratuitas.
- Video y audio usan archivos de adelanto separados.
- El original se sirve solamente después de verificar membresía o al propietario del contenido.

## 15. Dependencia nueva para documentos

Esta versión usa `pdf-lib` para crear en el navegador el PDF de adelanto con solo las primeras páginas. Está incluida en `package.json`. Como el proyecto usa `pnpm install --no-frozen-lockfile`, Vercel instalará la dependencia durante el siguiente deployment.
