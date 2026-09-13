# KeyTube V15

Corrección del adelanto automático para videos y audios de pago.

- Los videos completos pueden seguir pesando hasta 500 MB.
- El navegador genera automáticamente un adelanto de aproximadamente 10 segundos.
- Se corrigió un falso rechazo de los WebM creados por Chrome/Edge.
- El servidor sigue aceptando solamente WebM/WAV para adelantos y mantiene el límite de 20 MB para estos archivos pequeños.
- El archivo completo continúa en Vercel Blob privado.
- Después del adelanto, el reproductor puede mostrar el bloqueo/pixelado y la opción de membresía.

No requiere cambios SQL ni nuevas variables de entorno.
