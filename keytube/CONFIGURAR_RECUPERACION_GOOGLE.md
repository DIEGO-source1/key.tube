# Activar recuperación de cuenta y acceso con Google

El código ya incluye ambas funciones. Para que funcionen en producción hay que configurar las credenciales privadas en Vercel.

## 1. Recuperación de cuenta por correo

KeyTube usa Resend por HTTPS para enviar el código de 6 dígitos.

1. Crea una cuenta en Resend.
2. Verifica el dominio desde el que enviarás los correos.
3. Crea una API Key con permiso de envío.
4. En Vercel abre tu proyecto → Settings → Environment Variables y agrega:

```text
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=KeyTube <no-reply@tu-dominio.com>
```

5. Vuelve a desplegar el proyecto.

La pantalla de inicio de sesión mostrará **¿Olvidaste tu contraseña?**. El usuario escribe su correo, recibe un código de 6 dígitos y define una contraseña nueva.

Seguridad aplicada:
- Código válido por 10 minutos.
- Máximo 5 intentos por código.
- El código no se guarda en texto plano.
- El código solo sirve una vez.
- Después del cambio se cierran las sesiones antiguas.
- La respuesta inicial no confirma si un correo existe o no.
- También funciona con cuentas creadas originalmente con Google.

La tabla `password_recovery_codes` se crea automáticamente cuando se usa la recuperación. Para una actualización manual de Neon también está el archivo:

```text
neon/004_password_recovery.sql
```

## 2. Continuar con Google

En Google Cloud crea/configura un cliente OAuth de tipo **Aplicación web**.

En Vercel agrega:

```text
APP_ORIGIN=https://TU-DOMINIO
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxx
```

En Google debes registrar exactamente esta URI de redirección autorizada:

```text
https://TU-DOMINIO/api/auth/google/callback
```

Ejemplo, si tu sitio es `https://key-tube.vercel.app`:

```text
https://key-tube.vercel.app/api/auth/google/callback
```

Después vuelve a desplegar. El botón **Continuar con Google** se activará automáticamente.

Si el correo verificado por Google ya pertenece a una cuenta de KeyTube, se reutiliza esa misma cuenta en lugar de crear una duplicada.

## 3. Variables que deben quedar en Vercel

```text
DATABASE_URL=...
APP_ORIGIN=https://TU-DOMINIO
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
RESEND_API_KEY=...
EMAIL_FROM=KeyTube <no-reply@tu-dominio.com>
```

Nunca publiques `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY` ni `DATABASE_URL` en GitHub.
