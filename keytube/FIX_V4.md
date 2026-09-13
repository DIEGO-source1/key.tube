# Fix v4

Corrige el error de PostgreSQL/Neon `column reference "count" is ambiguous` durante registro/inicio de sesión.

La consulta de rate limit ahora califica explícitamente `auth_limits.count` dentro de `ON CONFLICT ... DO UPDATE` y en `RETURNING`.
