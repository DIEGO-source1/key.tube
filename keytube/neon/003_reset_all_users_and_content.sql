-- PELIGRO: BORRADO TOTAL DE DATOS DE KEYTUBE.
-- Ejecuta este archivo SOLO UNA VEZ si realmente quieres borrar
-- todos los usuarios, sesiones, publicaciones, comentarios, planes,
-- archivos y relaciones guardadas de la base actual.
-- La estructura de tablas se conserva.
BEGIN;

DELETE FROM media_grants;
DELETE FROM saved_posts;
DELETE FROM post_likes;
DELETE FROM follows;
DELETE FROM comments;
DELETE FROM creator_plans;
DELETE FROM challenges;
DELETE FROM oauth_states;
DELETE FROM sessions;
DELETE FROM auth_limits;
DELETE FROM posts;
DELETE FROM assets;
DELETE FROM media_objects;
DELETE FROM profiles;
DELETE FROM users;

COMMIT;
