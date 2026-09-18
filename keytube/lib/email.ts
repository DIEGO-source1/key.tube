const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] || char);
}

export function recoveryEmailEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendRecoveryCode(email: string, name: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error('RECOVERY_EMAIL_NOT_CONFIGURED');

  const safeName = escapeHtml(name || 'Hola');
  const safeCode = escapeHtml(code);
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Tu código de recuperación de KeyTube',
      text: `Hola ${name || ''}. Tu código de recuperación de KeyTube es ${code}. Caduca en 10 minutos. Si no solicitaste este cambio, ignora este correo.`,
      html: `<div style="font-family:Arial,sans-serif;background:#0b1220;color:#eaf0ff;padding:28px;border-radius:16px;max-width:520px;margin:auto">
        <h2 style="margin:0 0 12px">Recupera tu cuenta de KeyTube</h2>
        <p style="color:#b8c5dc">Hola ${safeName}. Usa este código para crear una nueva contraseña:</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#151f35;border:1px solid #394b70;border-radius:12px;padding:18px;text-align:center;margin:22px 0">${safeCode}</div>
        <p style="color:#b8c5dc">El código caduca en <strong>10 minutos</strong> y solo puede usarse una vez.</p>
        <p style="color:#8191ad;font-size:12px;margin-top:24px">Si no solicitaste recuperar tu cuenta, puedes ignorar este mensaje.</p>
      </div>`,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    console.error('KeyTube recovery email failed', response.status);
    throw new Error('RECOVERY_EMAIL_SEND_FAILED');
  }
}
