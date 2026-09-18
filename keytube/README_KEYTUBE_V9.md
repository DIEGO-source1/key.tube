# KeyTube V9 — reproducción inteligente de video

Esta versión conserva los cambios de V8 y añade control automático de reproducción según la visibilidad del video.

## Cambio principal

- Los videos gratuitos del feed se reproducen automáticamente únicamente cuando están suficientemente visibles en pantalla.
- Al bajar o subir y dejar menos del 55% del video visible, el video se pausa automáticamente.
- Si el video vuelve a estar visible, intenta reanudarse automáticamente.
- Si cambias de pestaña o minimizas el navegador, el video se pausa.
- Se conserva el botón de sonido. El video inicia silenciado por las restricciones normales de reproducción automática de los navegadores.
- Se mantiene el tamaño/proporción del video configurado en V8.
- Los videos de pago mantienen su adelanto y bloqueo; este cambio no expone el archivo completo.

## Subir a GitHub

Reemplaza los archivos de tu proyecto con los de esta versión y ejecuta:

```bash
git add .
git commit -m "version9 pausa video al hacer scroll"
git push origin main
```

Vercel debería iniciar automáticamente un nuevo deployment.

## Comportamiento esperado

1. Entras al feed.
2. Un video gratuito que queda principalmente visible se reproduce automáticamente y silenciado.
3. Puedes activar el sonido con el botón correspondiente.
4. Cuando haces scroll y el video sale de la zona visible, se pausa.
5. Cuando vuelves al video, se reanuda automáticamente cuando vuelve a estar suficientemente visible.

## Nota del navegador

Chrome, Edge, Safari y otros navegadores suelen bloquear la reproducción automática con sonido. Por eso KeyTube inicia los videos automáticos silenciados y permite habilitar el sonido mediante una interacción del usuario.
