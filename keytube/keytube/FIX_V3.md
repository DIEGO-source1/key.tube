# Fix v3

Corrige el error de TypeScript de `app/api/media/[id]/route.ts` en Vercel:
`Uint8Array<ArrayBufferLike>` no era asignable a `BodyInit`.

El cuerpo de la respuesta se copia ahora a un `ArrayBuffer` estándar antes de crear `Response`.
