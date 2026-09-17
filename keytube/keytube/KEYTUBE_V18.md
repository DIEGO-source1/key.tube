# KeyTube V18 — feed social y detalle mejorado

Esta versión toma como referencia las vistas compartidas por el proyecto y añade, con datos reales del sistema:

- Pestañas **Para ti / Siguiendo**.
- Feed vertical con reproducción automática de video al entrar en pantalla.
- **Seguir**, **Me gusta**, **Comentarios**, **Compartir** y **Guardar** en cada publicación.
- Contadores reales de vistas, Me gusta y comentarios.
- Panel lateral de **Tendencias** calculado a partir de las publicaciones y vistas reales.
- **Creadores recomendados** calculados con contenido y vistas reales, con botón Seguir.
- En el detalle: **Más del creador** y **Planes del creador**.
- Botón de compartir usando el menú nativo del teléfono cuando está disponible o copiando el enlace en escritorio.
- Avatar y nombre actual del perfil en las publicaciones.
- Conserva Vercel + Neon + Blob + Unlock y el comportamiento móvil de las versiones anteriores.

## Base de datos

En una base Neon ya existente, ejecutar una sola vez:

`neon/004_v18_social_feed.sql`

Este script crea `post_likes`; no borra usuarios ni publicaciones.

## Despliegue

No requiere nuevas variables de entorno. Después de aplicar los archivos y ejecutar el SQL:

```powershell
git add .
git commit -m "KeyTube V18 feed social tendencias y reacciones"
git push origin main
```

Vercel hará el despliegue del nuevo commit automáticamente.
