# KeyTube V19 — pagos, recomendaciones y seguimiento

Cambios principales:

- Panel de formas de pago dentro del contenido exclusivo.
  - Tarjeta: abre el checkout de Unlock. Solo funcionará como tarjeta si el creador habilitó Stripe en Unlock.
  - Crypto: abre el checkout Web3 de Unlock.
  - Otro dispositivo: comparte o copia el enlace de checkout para abrirlo desde un celular/tablet.
  - PayPal aparece como "Próximamente" porque todavía no existe una integración comercial de PayPal en el backend de KeyTube.
- Arreglo visual de "Creadores recomendados": nombre, estadísticas y botón Seguir ya no se solapan.
- Un usuario no puede seguirse a sí mismo:
  - se oculta el botón Seguir en sus propias publicaciones y perfil;
  - su propia cuenta no aparece en recomendados;
  - la API rechaza auto-seguimientos;
  - seguimientos propios antiguos dejan de contarse en la cuenta.

No requiere cambios de esquema en Neon.
