# KeyTube V8

Correcciones de compilación para Vercel:

- Compatibilidad de BigInt con el target TypeScript actual en `app/api/plans/route.ts`.
- El endpoint de subida ahora reconoce `role=avatar`.
- `updatePlanLock` acepta el campo `name` que envía el formulario de planes.

No requiere migraciones SQL nuevas.
