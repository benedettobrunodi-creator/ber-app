import { google } from 'googleapis';

interface WelcomeEmailParams {
  to: string;
  name: string;
  tempPassword: string;
}

function getOAuth2Client() {
  const tokenJson = process.env.GMAIL_OAUTH_TOKEN;
  if (!tokenJson) {
    throw new Error('GMAIL_OAUTH_TOKEN not configured');
  }

  const token = JSON.parse(tokenJson);
  const oauth2Client = new google.auth.OAuth2(
    token.client_id,
    token.client_secret,
    'https://developers.google.com/oauthplayground',
  );

  oauth2Client.setCredentials({
    refresh_token: token.refresh_token,
  });

  return oauth2Client;
}

function buildWelcomeHtml(name: string, tempPassword: string, email: string): string {
  const appUrl = process.env.FRONTEND_URL || 'https://ber-app.vercel.app';

  return `
    <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #D8DDD8;">
      <div style="background: #2D2D2D; padding: 32px; border-radius: 12px; text-align: center;">
        <h1 style="color: #fff; font-size: 28px; font-weight: 900; letter-spacing: 3px; margin: 0;">BÈR</h1>
        <p style="color: #868686; font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">Engenharia e Gerenciamento</p>
      </div>

      <div style="background: #fff; padding: 32px; border-radius: 12px; margin-top: 16px;">
        <h2 style="color: #2D2D2D; font-size: 18px; margin: 0 0 16px;">Bem-vindo(a), ${name}!</h2>
        <p style="color: #2D2D2D; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Sua conta no <strong>BÈR App</strong> foi criada. Use as credenciais abaixo para acessar:
        </p>

        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 4px; font-size: 13px; color: #868686;">Email:</p>
          <p style="margin: 0 0 12px; font-size: 15px; font-weight: 700; color: #2D2D2D;">${email}</p>
          <p style="margin: 0 0 4px; font-size: 13px; color: #868686;">Senha:</p>
          <p style="margin: 0; font-size: 18px; font-weight: 700; color: #2D2D2D; font-family: monospace; letter-spacing: 1px;">${tempPassword}</p>
        </div>

        <a href="${appUrl}/login" style="display: inline-block; background: #B5B820; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; margin-top: 8px;">
          Acessar BÈR App
        </a>
      </div>

      <div style="background: #fff; padding: 24px 32px; border-radius: 12px; margin-top: 16px;">
        <h3 style="color: #2D2D2D; font-size: 15px; margin: 0 0 16px;">Como instalar no celular</h3>

        <div style="margin-bottom: 16px;">
          <p style="color: #2D2D2D; font-size: 13px; font-weight: 700; margin: 0 0 6px;">iPhone (Safari):</p>
          <ol style="color: #2D2D2D; font-size: 13px; line-height: 1.8; margin: 0; padding-left: 20px;">
            <li>Abra <strong>${appUrl.replace('https://', '')}</strong> no <strong>Safari</strong></li>
            <li>Toque no botão <strong>Compartilhar</strong> (quadrado com seta para cima)</li>
            <li>Role e toque em <strong>"Adicionar à Tela de Início"</strong></li>
            <li>Toque em <strong>"Adicionar"</strong></li>
          </ol>
        </div>

        <div>
          <p style="color: #2D2D2D; font-size: 13px; font-weight: 700; margin: 0 0 6px;">Android (Chrome):</p>
          <ol style="color: #2D2D2D; font-size: 13px; line-height: 1.8; margin: 0; padding-left: 20px;">
            <li>Abra <strong>${appUrl.replace('https://', '')}</strong> no <strong>Chrome</strong></li>
            <li>Toque nos <strong>3 pontos</strong> no canto superior</li>
            <li>Toque em <strong>"Instalar aplicativo"</strong></li>
          </ol>
        </div>

        <p style="color: #868686; font-size: 11px; line-height: 1.5; margin: 16px 0 0;">
          Após instalar, o BÈR App aparece como ícone na tela inicial do celular, igual a um app normal.
        </p>
      </div>

      <div style="background: #fff; padding: 20px 32px; border-radius: 12px; margin-top: 16px;">
        <p style="color: #868686; font-size: 12px; line-height: 1.5; margin: 0;">
          Recomendamos alterar sua senha no primeiro acesso em <strong>Configurações &gt; Meu Perfil &gt; Alterar Senha</strong>.
        </p>
      </div>

      <p style="text-align: center; color: #868686; font-size: 11px; margin-top: 24px;">
        BÈR Engenharia e Gerenciamento — Este é um email automático.
      </p>
    </div>
  `;
}

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
  const { to, name, tempPassword } = params;

  try {
    const auth = getOAuth2Client();
    const gmail = google.gmail({ version: 'v1', auth });

    const subject = 'Bem-vindo ao BÈR App';
    const htmlBody = buildWelcomeHtml(name, tempPassword, to);

    const rawMessage = [
      `From: BÈR App <bruno@ber-engenharia.com.br>`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      htmlBody,
    ].join('\r\n');

    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });

    console.log(`Welcome email sent to ${to}`);
  } catch (error) {
    // Log but don't fail user creation
    console.error('Failed to send welcome email:', error);
  }
}
