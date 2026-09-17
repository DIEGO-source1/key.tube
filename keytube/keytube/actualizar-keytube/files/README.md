# KeyTube · Muro, perfiles y membresías

Portal en React y TypeScript con servidor, base de datos y almacenamiento privado. Cada persona puede abrir una cuenta, publicar contenido gratuito o exclusivo y administrar **dos planes propios: Básico y Premium**. El contenido exclusivo requiere una Key vigente de **Unlock**.

## Actualizar tu instalación actual en Windows

Si ya instalaste KeyTube-cuentas-y-planes, usa **KeyTube-actualizacion-muro.zip** para conservar las dependencias descargadas:

1. Detén el servidor con `Ctrl+C`.
2. Extrae la carpeta `actualizar-keytube` del ZIP dentro de tu carpeta actual `keytube` (junto a `package.json`).
3. Abre PowerShell en esa carpeta `keytube` y ejecuta:

```powershell
node .\actualizar-keytube\instalar.mjs
if ($LASTEXITCODE -eq 0) {
    pnpm.cmd db:setup
    if ($LASTEXITCODE -eq 0) {
        pnpm.cmd dev
    }
}
```

Confirma la nueva migración con `Y`. El actualizador guarda un respaldo de los archivos afectados y de la base D1 local si existe. Mantiene las dependencias, las variables de entorno, los usuarios y los archivos que hayas subido. Esta actualización no cambia el lockfile y no requiere `pnpm install`.

La actualización cambia el muro y los perfiles; no afirma resolver el error previo `ECONNRESET` de arranque en Windows. Si vuelve a aparecer, conserva el mensaje completo para diagnosticarlo por separado.

## Usar el muro y tu perfil

- **Inicio / Explorar**: todas las publicaciones; cambia entre **Más recientes · descendente** y **Más antiguas · ascendente**. **Cargar más** recorre el resto en ese mismo orden; **Actualizar** vuelve a consultar lo publicado.
- **Video / Foto / Música / Documento**: abre el estudio con ese formato seleccionado. También puedes elegir artículo escrito dentro del estudio.
- **Mi perfil / Editar perfil**: cambia nombre, biografía y foto; usa **Guardar cambios** o **Cancelar**. El nuevo nombre y foto se reflejan también en tus publicaciones anteriores.
- **Ver perfil público**: muestra tu biografía, publicaciones y planes sin mostrar el correo de tu cuenta.
- **⋯** en tus publicaciones: puedes eliminarlas después de confirmar. Los visitantes pueden guardar, comentar y compartir; no pueden eliminar publicaciones ajenas.
- **Siguiendo / Guardados**: muestran únicamente la selección de tu cuenta y mantienen los filtros y el orden.

## Iniciar en Windows

Requisitos: **Node.js 22.13 o posterior** y **pnpm 11.25.0**. Extrae el ZIP y abre PowerShell en la carpeta `keytube`:

```powershell
pnpm.cmd install --frozen-lockfile --prefer-offline
if ($LASTEXITCODE -eq 0) {
    pnpm.cmd db:setup
    if ($LASTEXITCODE -eq 0) {
        pnpm.cmd dev
    }
}
```

Si aparece la confirmación de migraciones, escribe `Y` y pulsa Enter. Abre **http://localhost:5173** cuando el servidor esté listo y conserva la terminal abierta. Si el puerto está ocupado, utiliza la dirección indicada por la terminal.

Si falta pnpm: `npm.cmd install --global pnpm@11.25.0`. En conexiones lentas puedes usar `pnpm.cmd install --frozen-lockfile --prefer-offline --network-concurrency=1 --config.fetch-timeout=600000 --config.fetch-retries=5`. No ejecutes la base o el servidor mientras la instalación esté incompleta.

Pulsa **Crear cuenta**, escribe nombre, correo y una contraseña de al menos 10 caracteres. No hay una cuenta predeterminada ni una contraseña compartida. Cierra sesión para registrar otra persona o usa otro perfil de navegador. El registro funciona sin Google, wallet ni una cuenta de Cloudflare.

## Lo que incluye

- Registro, inicio y cierre de sesión, con cuentas independientes.
- Acceso opcional con Google y vinculación desde una cuenta existente.
- Perfil editable con nombre, biografía y foto propia (JPG/PNG/WEBP, hasta 2 MB).
- Perfil público, accesos a publicaciones y planes, guardados, seguimiento y comentarios.
- Estudio para publicar video, música, imágenes, PDF/TXT y artículos.
- Elección de acceso **Gratis**, **Básico** o **Premium** por publicación.
- Dos planes por creador, con precios, duración, beneficios y formatos configurables.
- Creación de PublicLocks desde la wallet o vinculación de Locks existentes.
- Checkout oficial de Unlock y verificación real de Keys desde el servidor.
- Muro vertical con autor, fecha, descripción ampliable y archivos grandes.
- Orden ascendente/descendente, búsqueda, filtros y paginación de 20 publicaciones.
- Menú por publicación: abrir, guardar, cambiar acceso, ocultar, volver a publicar y eliminar si eres su propietario.
- Compartir mediante enlace, botón Actualizar y diseño adaptable a celulares.
- Base SQLite limpia, SQL, migraciones y pruebas de seguridad.

El muro empieza vacío: **no incluye videos ni creadores de demostración**. Solo muestra publicaciones guardadas en la base de datos. Las cuentas reales existentes se conservan; la migración retira avatares de ejemplo y referencias antiguas a publicaciones ficticias.

## Contenido gratuito y adelantos

| Formato | Acceso gratuito | Acceso exclusivo |
| --- | --- | --- |
| Video | Archivo completo | WebM automático de hasta 10 segundos y aviso de compra al terminar. |
| Música/audio | Archivo completo | WAV automático de hasta 10 segundos y aviso de compra al terminar. |
| Imagen | Original completo | Copia reducida, difuminada y marcada; original protegido. |
| Documento | PDF/TXT completo | Introducción pública; archivo protegido. |
| Artículo | Texto completo | Introducción pública; texto completo protegido. |

El original exclusivo **no se envía al visitante antes de verificar la membresía**. El adelanto es otro archivo: quitar el bloqueo visual no revela el original. El video se recorta ligeramente antes de 10 segundos para respetar el límite al codificar el último cuadro. Si el archivo dura menos de 10 segundos se muestra aproximadamente el 90 %.

Usa Chrome o Edge para generar adelantos de video y mantén visible la pestaña. MP4 con H.264 ofrece buena compatibilidad. El servidor valida los adelantos WebM/WAV y rechaza MP4 originales enviados directamente como adelanto.

Límites: **500 MB por archivo completo**, **20 MB por portada o adelanto**, **2 MB por avatar** y **5 GB por cuenta**, artículos de hasta 60 000 caracteres. No incluye transcodificación de videos grandes, streaming adaptativo ni DRM.

## Crear los dos planes

1. Regístrate y abre **Mis planes**.
2. Completa nombre, beneficios, formatos, precio y duración de Básico.
3. Para una demo, elige Base Sepolia o Sepolia y una wallet con ETH de prueba para gas. Ethereum (red principal), Base y Polygon utilizan fondos reales. Los nuevos planes seleccionan Ethereum por defecto; los planes existentes conservan su red. En Ethereum se necesita ETH en Ethereum Mainnet para las comisiones.
4. Pulsa **Crear Lock y guardar plan**. Confirma la transacción y después la firma que vincula el plan a tu cuenta. Se crea un PublicLock versión 15 con capacidad inicial de 1000 Keys.
5. Si ya tienes un Lock, marca **Ya tengo un Lock**, pega su dirección y coloca su precio y duración exactos. Tu wallet debe ser LockManager.
6. Repite para Premium con la misma wallet y red, pero otro Lock. Premium debe cubrir los formatos incluidos en Básico.
7. Publica contenido y selecciona su acceso. Premium abre las publicaciones de Básico y Premium; Básico solo abre las asignadas a Básico.
8. Puedes editar precios o duración: la wallet confirma los cambios en el contrato antes de guardar la configuración.

Los precios se definen en **ETH o POL**, la moneda nativa de la red. Este editor no configura planes con USDC u otros ERC20. Los compradores ven precios consultados en el contrato; el checkout confirma las condiciones. Son membresías de duración definida, sin prometer cobros automáticos recurrentes. Cambiar las condiciones no revoca automáticamente las Keys ya vigentes.

KeyTube no crea credenciales independientes de Unlock ni custodia claves privadas. Cada creador abre el panel de Unlock con su wallet. No se ha creado ni pagado un Lock por ti: ocurre cuando confirmas la transacción.

## Activar Google

La integración OAuth/OpenID Connect está implementada. **Necesita las credenciales reales del proyecto de Google**; sin ellas, el botón explica que aún no está disponible.

1. En [Google Cloud](https://console.cloud.google.com/), configura Google Auth Platform, la pantalla de consentimiento y los usuarios de prueba si corresponde.
2. Crea un cliente OAuth de tipo **Aplicación web**.
3. Autoriza exactamente esta URI local: `http://localhost:5173/api/auth/google/callback`.
4. Copia `.env.example` como `.env` en la raíz y completa:

```dotenv
APP_ORIGIN=http://localhost:5173
GOOGLE_CLIENT_ID=tu-cliente.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-secreto
```

5. Reinicia el servidor y pulsa **Continuar con Google**.
6. En alojamiento, configura esas tres variables en el servidor. Usa el dominio HTTPS real como `APP_ORIGIN` y autoriza ese dominio más `/api/auth/google/callback` en Google. El secreto es privado; no uses prefijos `VITE_` o `NEXT_PUBLIC_`.

Si el correo ya tiene una cuenta con contraseña, entra primero y usa **Mi cuenta → Vincular mi cuenta con Google**, eligiendo el mismo correo. No se fusionan cuentas automáticamente por coincidencia de dirección.

Google se verifica con RS256, claves públicas oficiales, emisor, audiencia, caducidad, correo verificado y nonce. El flujo usa PKCE, estado de un solo uso y cookie HttpOnly. [Documentación de Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).

## Demostración real

1. Crea dos planes en una red de prueba. Publica un video de más de 10 segundos en Básico, otro contenido en Premium y uno gratuito.
2. Abre otra sesión de navegador con una cuenta y wallet distintas, sin Keys.
3. El gratuito debe abrirse completo; el exclusivo solo muestra su adelanto. Verificar una wallet sin Key debe rechazar el contenido privado.
4. Compra Básico en el checkout, regresa y pulsa **Ya tengo membresía · verificar acceso** con la wallet receptora.
5. Básico debe abrir únicamente su nivel. Prueba una Key Premium para comprobar ambos niveles.
6. Cambia a una wallet sin Key o deja vencer la membresía: la siguiente solicitud privada debe rechazarse.

El retorno del checkout, una sesión de usuario o localStorage nunca conceden acceso por sí solos. Las transacciones y pagos reales requieren tus wallets; no se han ejecutado por ti.

## Base de datos y actualización

`database/keytube.sqlite` y `database/keytube.sql` contienen **13 tablas vacías**, con sus índices. Puedes inspeccionarlas con un visor SQLite. La aplicación local utiliza el emulador D1 de `.wrangler/state/`, preparado por `db:setup`, y no abre directamente la base de distribución.

| Tabla | Datos |
| --- | --- |
| users | Correo, nombre, hash de contraseña y vínculo Google. |
| sessions | Hash del identificador de sesión y caducidad. |
| oauth_states | Estado, nonce, PKCE y cuenta a vincular. |
| auth_limits | Límites temporales de intentos. |
| creator_plans | Dos planes por creador, beneficios, formatos, Lock y red. |
| posts | Introducción pública, texto completo, nivel y archivos. |
| assets | Propietario, formato y referencia privada a R2. |
| challenges | Autorizaciones de firma de un solo uso. |
| media_grants | Hash de tickets temporales de archivos. |
| profiles | Perfiles de creadores. |
| saved_posts | Favoritos por usuario. |
| follows | Seguimiento de creadores. |
| comments | Comentarios y sus autores. |

Las Keys viven en la blockchain; los archivos, en R2. La distribución no incluye cuentas ni datos reales.

Para actualizar, conserva `.wrangler/state/` y ejecuta `pnpm.cmd db:setup`. La migración nueva **0002_nosy_the_enforcers.sql** añade cuentas y planes sin borrar publicaciones anteriores. No se modifican 0000/0001. No importes el SQL completo sobre una base existente.

Las cuentas anteriores del acceso ChatGPT/local no se reclaman automáticamente: las cuentas nuevas son independientes. El contenido anterior conserva su dueño y autorización; no se reasigna sin comprobar su propiedad.

```powershell
pnpm.cmd db:generate  # Después de modificar db/schema.ts
pnpm.cmd db:setup     # Aplicar migraciones pendientes
pnpm.cmd db:export    # Reconstruir SOLO las bases vacías de distribución
```

## Arquitectura y protección

| Capa | Implementación |
| --- | --- |
| Interfaz | React 19, TypeScript, CSS adaptable y Lucide. |
| Servidor | Vinext/Vite, compatible con Cloudflare Workers. |
| Cuentas | Scrypt con sal aleatoria y sesiones HttpOnly de 7 días. |
| Google | OAuth/OpenID Connect con PKCE y firmas verificadas. |
| Datos/archivos | D1/SQLite, migraciones Drizzle y R2 privado. |
| Membresías | Viem, factorías oficiales Unlock y PublicLock. |

El catálogo no devuelve cuerpo privado, correo ni referencia del archivo original. El UUID público del creador permite abrir su perfil. Los planes y publicaciones exclusivas requieren firma vinculada a cuenta, red, nonce, propósito y contenido exacto. El servidor verifica LockManager, procedencia del Lock, precio y duración.

`POST /api/access` consulta `getHasValidKey` en los Locks aceptados. Los archivos privados usan tickets de hasta cuatro horas para videos largos (se invalidan al restringir, ocultar o eliminar la publicación), almacenados como hash, y vuelven a consultar la Key al servir cada archivo o rango. Los gratuitos exigen que la publicación sea realmente gratuita y corresponda al archivo solicitado. Cambiar wallet, red o publicación borra el acceso del reproductor.

Las escrituras validan origen, formato y propietario. Los accesos tienen límites temporales. Las contraseñas usan scrypt `N=16384, r=8, p=5` con derivaciones serializadas por instancia para limitar memoria; es un [perfil documentado por OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Esta versión no incluye recuperación de contraseña, verificación por correo del registro, moderación ni facturación fiscal. Google exige correo verificado. Un miembro autorizado puede guardar o capturar el contenido que recibió; el control de entrega no es DRM.

## Código y pruebas

- `app/keytube-v2.tsx`, `app/keytube-v2.css`: aplicación actual.
- `components/keytube-forms.tsx`: acceso, planes y publicación.
- `lib/auth.ts`, `lib/google-auth.ts`: cuentas y Google.
- `lib/lock-client.ts`, `lib/plans.ts`, `lib/unlock.ts`: membresías.
- `lib/preview-client.ts`, `lib/preview-validation.ts`: adelantos.
- `app/api/`: servidor; `db/`, `drizzle/`, `database/`: datos.
- `tests/`: aislamiento, firmas, sesiones, planes, duración y acceso.

```powershell
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
```

Las pruebas usan SQLite, scrypt, firmas EVM y verificación RSA reales. R2, Google HTTP y estado de la blockchain se simulan solo en las pruebas. La compra y el acceso a Google con cuentas reales requieren tus wallets y credenciales.

Fuentes: [creación de Locks](https://docs.unlock-protocol.com/core-protocol/public-lock/deploying-locks), [redes de Unlock](https://docs.unlock-protocol.com/core-protocol/unlock/networks).

## Alojamiento

El sitio existente conserva su audiencia. El registro interno no cambia quién puede abrir la URL alojada: para una demo externa, el propietario debe habilitar esa audiencia. El proyecto descargado funciona localmente con cuentas independientes.

No compartas `.env`, secretos OAuth, claves de wallet, datos de `.wrangler/state/` ni `node_modules`.


## Actualización: wallet, videos grandes y control del autor

- En **Mi cuenta → Conectar wallet**, elige la extensión detectada y autoriza su solicitud. Compatible con descubrimiento EIP-6963 y extensiones que ofrecen `window.ethereum` (MetaMask, Rabby y Coinbase Wallet). Si hay varias, KeyTube usa la seleccionada para conectar, firmar y administrar Locks. Sin extensión se muestra una guía; no se incluye WalletConnect por QR. En el móvil usa el navegador integrado de tu wallet.
- Cada archivo completo admite hasta 500 MB (500 × 1024² bytes); los archivos grandes se envían por partes de 8 MB, con progreso, cancelación y reintentos de partes interrumpidas. La carga completa debe finalizar dentro de 24 horas. Mantén la pestaña abierta; cerrar la pestaña requiere volver a seleccionar el archivo.
- Las reservas de cargas pendientes cuentan dentro de los 5 GB por cuenta. Las cargas vencidas se limpian en el siguiente inicio de carga del autor.
- **Mi contenido → Acceso y visibilidad** permite ocultar, volver a publicar y elegir Gratis, Básico o Premium. También aparece en las publicaciones del autor y su página de detalle.
- Ocultar conserva el contenido para el autor y bloquea el muro, las vistas previas y los enlaces para visitantes y miembros. Cambiar de plan invalida los enlaces de acceso anteriores. La comprobación de membresía vuelve a ejecutarse al solicitar cada archivo o rango.
- Cambiar una publicación gratuita a membresía conserva el adelanto separado si existe. Si no tenía adelanto, solo se muestra la introducción y portada; no se entrega el original a visitantes.
- Eliminar pide confirmación, retira comentarios y guardados y libera los archivos que ninguna otra publicación utiliza. Lo ya descargado por una persona no puede retirarse de su dispositivo.
- Los adelantos automáticos de nuevos videos y audios exclusivos siguen siendo de hasta 10 segundos. No hay límite adicional de duración del video completo dentro del tamaño admitido.

Referencias técnicas: https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/ y https://eips.ethereum.org/EIPS/eip-6963.
