# KeyTube V6 - corrección de build

Esta revisión corrige el build de Vercel cuando el repositorio conserva el archivo antiguo `app/keytube.tsx`.

La interfaz activa sigue en `app/keytube-v2.tsx`. El archivo `app/keytube.tsx` ahora es solo un puente compatible y ya no contiene referencias antiguas a `SAMPLE_POSTS` ni a la propiedad `sample`.

## Subida

Reemplaza la carpeta `keytube` del repositorio por esta versión y ejecuta:

```powershell
git add .
git commit -m "KeyTube V6 corregir componente antiguo y build"
git push origin main
```

No cambies la configuración de Vercel ni `DATABASE_URL`.
