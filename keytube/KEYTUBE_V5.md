# KeyTube v5 · Vercel + Neon + Unlock

Esta versión elimina el contenido ficticio precargado y deja el muro basado únicamente en registros reales de Neon.

## Cambios incluidos

- Perfil editable: nombre público, biografía y avatar.
- Wallet vinculable/desvinculable al perfil mediante firma de MetaMask.
- Publicaciones eliminables por su creador, incluyendo limpieza de archivos que ya no se usan.
- Contador real de vistas al abrir una publicación.
- Orden de publicaciones: más recientes, más antiguas, más vistas y menos vistas.
- Planes de membresía Unlock creados o vinculados por cada creador.
- El creador decide nombre, precio, duración, red, beneficios y formatos cubiertos por su plan.
- La wallet que administra el Lock queda asociada al perfil/plan para evitar que otra cuenta reclame el mismo plan.
- El despliegue de nuevos Locks usa `createUpgradeableLock`, para que Unlock use la versión actual configurada por su factory.
- Sin usuarios ni publicaciones demo en el código.

## Actualizar una base Neon existente

En Neon > SQL Editor ejecuta primero:

`neon/002_v5_features.sql`

Este script agrega `profiles.wallet` y `posts.views` sin borrar datos.

### Borrar todos los usuarios y contenido existentes

Para hacer un reinicio total, ejecuta después:

`neon/003_reset_all_users_and_content.sql`

**Advertencia:** elimina también tu cuenta actual, publicaciones, comentarios, planes, sesiones y archivos. Se usa una sola vez. Después debes registrarte de nuevo.

## Vercel

- Framework Preset: Next.js
- Root Directory: `keytube`
- Build/Output/Install/Development: deja los overrides apagados para que Vercel use la detección automática.
- Conserva `DATABASE_URL` apuntando a Neon.

## Flujo de prueba

1. Regístrate de nuevo.
2. Abre Mi cuenta y edita el perfil.
3. Vincula MetaMask desde Mi cuenta.
4. En Mis planes, crea un Lock de prueba en Base Sepolia o Sepolia y define precio/duración.
5. Publica contenido gratis y/o para miembros.
6. Abre publicaciones para incrementar vistas y prueba los cuatro órdenes.
7. En Mi contenido elimina una publicación propia.
