# KeyTube V10 — versión integrada

Esta versión conserva lo que ya funcionaba en V9 y añade las mejoras de comunidad, descubrimiento, perfiles, estadísticas, seguridad y experiencia móvil.

## 1. Qué incluye V10

### Comunidad y notificaciones
- Me gusta en publicaciones con contador.
- Comentarios y respuestas a comentarios.
- Seguir/dejar de seguir creadores.
- Notificaciones por me gusta, comentarios, respuestas, nuevos seguidores y nuevas publicaciones de creadores seguidos.
- Aviso al creador cuando un usuario verifica por primera vez un acceso de membresía.
- Compartir publicaciones con el sistema nativo del navegador o copiar enlace.

### Descubrimiento y recomendaciones
- Feed **Para ti** personalizado a partir de creadores seguidos, categorías, formatos, likes, guardados e historial.
- Feed **Descubrir** separado.
- Tendencias conservadas en la columna derecha.
- Buscador por título, creador, categoría e introducción.
- Filtros por formato, categoría y acceso (gratis/de pago).
- Orden por recientes, antiguas, más vistas y menos vistas.
- Precarga de las primeras publicaciones del feed para que la navegación se sienta más rápida.

### Reproducción y rendimiento del feed
- Solo un video automático puede reproducirse a la vez.
- Los videos gratuitos empiezan automáticamente silenciados.
- Botón visible para activar/desactivar sonido.
- Si el video deja de estar suficientemente visible al hacer scroll, se pausa.
- Si vuelve a quedar visible, puede reanudarse.
- Se pausa al cambiar de pestaña/minimizar.
- Respeta la relación de aspecto del archivo original.
- Lazy loading y carga progresiva de medios donde corresponde.

### Contenido gratis y contenido de pago
**Gratis**
- Imágenes completas.
- Videos completos con reproducción automática en feed.
- Audio completo.
- Documentos completos.
- Artículos completos.

**De pago**
- Imagen: se publica una copia fuertemente pixelada y con marca de agua. El original queda protegido.
- Video: adelanto aproximado de 10 segundos y después bloqueo.
- Audio/canción: adelanto aproximado de 10 segundos y después bloqueo.
- Documento PDF/TXT: el creador elige de 1 a 10 páginas públicas; el original completo queda protegido.
- Artículo: introducción pública y cuerpo completo protegido.
- El archivo original se entrega solo después de verificar el acceso/membresía en servidor.

### Membresías
- Plan Básico y Premium mediante Unlock Protocol.
- Cada plan puede usar la duración que configure el creador (por ejemplo 30 días o 365 días).
- El sistema valida red, Lock, precio, duración y wallet administradora.
- El contenido puede vincularse a un plan y Premium puede cubrir también contenido Básico.
- En **Mi cuenta** aparece un historial de accesos que KeyTube verificó con la wallet.

> Importante: el historial de V10 registra **accesos verificados**, no una contabilidad financiera completa de pagos on-chain. Para mostrar ingresos exactos, comisiones y transacciones históricas de todas las wallets hace falta añadir más adelante un indexador/webhook blockchain.

### Perfiles profesionales
- Foto de perfil.
- Portada horizontal.
- Biografía.
- Web, Instagram y YouTube.
- Número de publicaciones, seguidores, vistas y likes.
- Pestañas por tipo de contenido.
- Insignia de creador verificado administrada desde moderación.

### Estadísticas del creador
- Publicaciones totales.
- Vistas totales.
- Likes.
- Comentarios.
- Seguidores.
- Accesos de membresía verificados.
- Top 10 de publicaciones por rendimiento.
- Gráfica de actividad para 7, 30 o 90 días (likes, comentarios, seguidores nuevos y accesos verificados).

### Historial y colecciones
- Historial de publicaciones abiertas.
- Para video/audio se guarda posición y porcentaje para **Continuar viendo/escuchando**.
- Colecciones personales con nombre personalizado.
- Agregar o quitar publicaciones de colecciones.

### Seguridad y moderación
- Recuperación de contraseña por código temporal de 6 dígitos.
- Código con caducidad, límite de intentos y un solo uso.
- Inicio de sesión con Google.
- Rate limit de autenticación ya existente.
- Reportar publicación, comentario o creador.
- Bloquear/desbloquear creadores.
- Panel `/admin` para revisar reportes.
- Administradores pueden resolver/descartar reportes y marcar creadores como verificados.
- Originales de contenido de pago no se exponen como URL pública directa antes de verificar acceso.

### PWA / instalación como app
- `manifest.webmanifest`.
- Service Worker.
- Se puede instalar desde un navegador compatible como aplicación web.
- Recursos estáticos pueden quedar en caché; las API privadas no se cachean.

---

# 2. Requisitos

Para desarrollo local:

- Node.js **22.13 o superior**.
- pnpm **11.25.0**.
- Una base de datos Neon PostgreSQL.
- Un Blob Store privado de Vercel para archivos grandes/privados.
- Cuenta de Google Cloud si usarás Google Login.
- Resend si usarás recuperación por correo.
- MetaMask/Unlock para planes de membresía.

---

# 3. Instalar en tu computadora

Descomprime el ZIP y abre una terminal dentro de la carpeta que contiene `package.json`.

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install
```

Después crea `.env.local` tomando `.env.example` como referencia.

Ejemplo:

```env
DATABASE_URL=postgresql://...
APP_ORIGIN=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
RESEND_API_KEY=...
EMAIL_FROM=KeyTube <no-reply@tu-dominio.com>
BLOB_READ_WRITE_TOKEN=...
ADMIN_EMAILS=tu-correo@gmail.com
```

Nunca subas `.env.local`, API keys, contraseñas o secretos a GitHub.

Para iniciar:

```bash
pnpm dev
```

Abre:

```text
http://localhost:3000
```

---

# 4. Preparar Neon

## Si tu KeyTube ya existe

No vuelvas a reiniciar la base. Ejecuta solamente las migraciones que todavía no aplicaste.

Para la recuperación de contraseña:

```text
neon/004_password_recovery.sql
```

Para todas las funciones nuevas de V10:

```text
neon/005_keytube_v10.sql
```

En Neon:
1. Abre tu proyecto.
2. Entra en **SQL Editor**.
3. Abre `neon/005_keytube_v10.sql`.
4. Copia todo el contenido.
5. Pégalo en SQL Editor.
6. Presiona **Run**.
7. Debe terminar sin errores.

`005_keytube_v10.sql` usa `IF NOT EXISTS` y **no elimina cuentas ni publicaciones**.

### MUY IMPORTANTE

No ejecutes:

```text
neon/003_reset_all_users_and_content.sql
```

salvo que realmente quieras reiniciar datos. Ese archivo no forma parte de la actualización normal.

## Instalación nueva desde cero

Aplica en este orden:

```text
neon/001_init.sql
neon/002_v5_features.sql
neon/004_password_recovery.sql
neon/005_keytube_v10.sql
```

No necesitas ejecutar `003_reset_all_users_and_content.sql`.

---

# 5. Variables de Vercel

En:

**Vercel → proyecto KeyTube → Settings → Environment Variables**

Configura:

```text
DATABASE_URL
APP_ORIGIN
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
RESEND_API_KEY
EMAIL_FROM
BLOB_READ_WRITE_TOKEN
ADMIN_EMAILS
```

## APP_ORIGIN

En producción debe ser tu URL pública exacta, sin `/` final. Ejemplo:

```text
https://key-tube.vercel.app
```

## ADMIN_EMAILS

Opcional, pero recomendado para usar el panel de moderación.

Un administrador:

```env
ADMIN_EMAILS=tucorreo@gmail.com
```

Varios administradores:

```env
ADMIN_EMAILS=uno@gmail.com,dos@gmail.com
```

Después de guardarlas debes hacer un nuevo deployment para que Vercel las use.

---

# 6. Google Login

En Google Cloud crea un OAuth Client de tipo **Web application**.

Si tu dominio es:

```text
https://key-tube.vercel.app
```

usa:

### Authorized JavaScript origin

```text
https://key-tube.vercel.app
```

### Authorized redirect URI

```text
https://key-tube.vercel.app/api/auth/google/callback
```

Luego copia:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

hacia Vercel.

Si cambias el dominio de KeyTube, cambia también `APP_ORIGIN` y la redirect URI de Google.

---

# 7. Recuperación de contraseña por correo

Configura:

```text
RESEND_API_KEY
EMAIL_FROM
```

Ejemplo:

```env
EMAIL_FROM=KeyTube <cuentas@tudominio.com>
```

Para enviar correos a usuarios reales normalmente necesitas tener el dominio remitente verificado en Resend. El plan gratuito de Resend puede utilizarse dentro de sus límites actuales.

El flujo es:

```text
¿Olvidaste tu contraseña?
→ correo
→ código de 6 dígitos
→ nueva contraseña
```

---

# 8. Vercel Blob

Conecta un Blob Store al proyecto desde Vercel. El proyecto utiliza almacenamiento privado para archivos completos.

Vercel normalmente crea/configura la variable necesaria del store. En el proyecto también se contempla:

```text
BLOB_READ_WRITE_TOKEN
```

No hagas público el store que contiene originales de contenido de pago.

---

# 9. Moderación y creador verificado

1. Pon tu correo en `ADMIN_EMAILS`.
2. Haz Redeploy.
3. Inicia sesión en KeyTube con ese correo.
4. Abre:

```text
/admin
```

Desde ahí puedes revisar reportes y verificar creadores.

Los usuarios pueden reportar o bloquear desde los perfiles/contenidos.

---

# 10. Rutas nuevas principales

```text
/notifications     Notificaciones
/history           Historial / continuar viendo
/collections       Colecciones
/studio/stats      Estadísticas de creador
/admin             Moderación (solo admin)
/creator/ID        Perfil profesional de creador
```

---

# 11. Subir esta versión a GitHub

Si ya tienes el repositorio conectado a Vercel, reemplaza los archivos del proyecto por los de V10 y ejecuta:

```bash
git add .
git commit -m "version10 mejoras completas"
git push origin main
```

Los avisos de Windows del tipo:

```text
LF will be replaced by CRLF
```

son advertencias de finales de línea, no fallos del deployment.

Vercel detectará el push y desplegará automáticamente.

---

# 12. Si Vercel falla

Busca la parte final del log desde:

```text
Running TypeScript ...
```

hasta el final y compártela para localizar el archivo exacto.

`.vercelignore` ya excluye copias antiguas, ejemplos y respaldos que no deben entrar al build.

Esta versión conserva temporalmente la configuración de producción que permite desplegar mientras se terminan de limpiar algunos tipos heredados del proyecto. Antes de una versión empresarial conviene volver a exigir el typecheck completo en CI.

---

# 13. Pruebas recomendadas después del deploy

Hazlas en este orden:

1. Crear una cuenta nueva.
2. Cerrar sesión y volver a entrar.
3. Recuperar contraseña por correo.
4. Entrar con Google.
5. Editar perfil + portada + redes.
6. Publicar imagen/video/audio/documento gratuito.
7. Confirmar que el video gratuito se reproduce automáticamente silenciado y se pausa al salir de pantalla.
8. Publicar contenido de pago.
9. Confirmar que la imagen esté pixelada y que PDF/audio/video solo muestren su adelanto.
10. Crear plan en Unlock y verificar acceso con una wallet que tenga membresía.
11. Dar like, comentar, responder y seguir a otro creador.
12. Comprobar `/notifications`.
13. Abrir varios contenidos y comprobar `/history`.
14. Crear una colección y agregar publicaciones.
15. Revisar `/studio/stats` y cambiar 7/30/90 días.
16. Reportar contenido con una cuenta normal y revisar `/admin` con la cuenta administradora.
17. Instalar KeyTube desde el navegador como PWA si el navegador muestra la opción.

---

# 14. Qué conviene hacer después de V10

V10 deja preparada una base mucho más completa, pero si KeyTube crece de verdad conviene añadir:

- cola de trabajos para transcodificación de video;
- CDN/streaming HLS adaptativo;
- indexador blockchain para ingresos/transacciones exactas;
- notificaciones push Web Push;
- antivirus/análisis de archivos subidos;
- panel de moderación con eliminación/suspensión administrativa;
- tests E2E automáticos antes de cada deploy;
- volver a activar typecheck estricto como bloqueo obligatorio de producción.

