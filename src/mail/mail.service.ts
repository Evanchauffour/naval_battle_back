import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import mjml2html from 'mjml';

@Injectable()
export class MailService {
  private readonly resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  /**
   * Compile un template MJML en HTML
   */
  private compileTemplate(mjmlContent: string): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const result = mjml2html(mjmlContent, {
      keepComments: false,
      beautify: false,
    }) as { html: string; errors: Array<{ message: string }> };

    if (result.errors && result.errors.length > 0) {
      console.error('MJML Compilation Errors:', result.errors);
    }

    return result.html;
  }

  /**
   * Envoie un email de vérification
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    const mjmlTemplate = `
      <mjml>
        <mj-head>
          <mj-title>Vérification de votre email</mj-title>
          <mj-preview>Vérifiez votre adresse email pour Naval Battle</mj-preview>
          <mj-attributes>
            <mj-all font-family="'Georgia', 'Times New Roman', serif"></mj-all>
            <mj-text font-weight="400" font-size="16px" color="#000000" line-height="24px" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#ffffff">
          <!-- Header -->
          <mj-section background-color="#000000" padding="30px 20px">
            <mj-column>
              <mj-text align="center" color="#ffffff" font-size="28px" font-weight="normal" letter-spacing="2px">
                NAVAL BATTLE
              </mj-text>
            </mj-column>
          </mj-section>

          <!-- Main Content -->
          <mj-section background-color="#ffffff" padding="50px 40px">
            <mj-column>
              <mj-text font-size="22px" font-weight="normal" color="#000000" align="center" padding-bottom="30px">
                Vérification de votre compte
              </mj-text>
              
              <mj-divider border-color="#000000" border-width="1px" padding="0 0 30px 0"></mj-divider>
              
              <mj-text font-size="16px" color="#000000" line-height="26px" padding-bottom="25px">
                Bonjour,
              </mj-text>
              
              <mj-text font-size="16px" color="#000000" line-height="26px" padding-bottom="30px">
                Nous vous remercions de votre inscription. Pour activer votre compte et commencer à jouer, 
                veuillez cliquer sur le bouton ci-dessous afin de vérifier votre adresse email.
              </mj-text>

              <mj-button 
                background-color="#000000" 
                color="#ffffff" 
                font-size="14px" 
                font-weight="normal"
                letter-spacing="1px"
                padding="35px 0px"
                border-radius="0px"
                href="${verificationUrl}"
                inner-padding="12px 40px"
              >
                VÉRIFIER MON EMAIL
              </mj-button>

              <mj-text font-size="14px" color="#666666" line-height="22px" padding-top="40px">
                Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :
              </mj-text>

              <mj-text font-size="13px" color="#000000" line-height="22px" padding-top="10px" padding-bottom="30px">
                ${verificationUrl}
              </mj-text>
              
              <mj-divider border-color="#e0e0e0" border-width="1px" padding="30px 0"></mj-divider>
              
              <mj-text font-size="14px" color="#666666" line-height="22px" padding-top="20px">
                <strong style="color: #000000;">Sécurité de votre compte</strong><br/>
                La vérification de votre email nous permet de sécuriser votre compte et de vous contacter 
                en cas de besoin concernant vos parties.
              </mj-text>
            </mj-column>
          </mj-section>

          <!-- Footer -->
          <mj-section background-color="#f5f5f5" padding="30px 40px">
            <mj-column>
              <mj-text align="center" color="#666666" font-size="12px" line-height="20px">
                Ce lien de vérification expire dans 24 heures.<br/>
                Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.
              </mj-text>
              
              <mj-divider border-color="#cccccc" padding="25px 0 20px 0"></mj-divider>
              
              <mj-text align="center" color="#999999" font-size="11px" letter-spacing="0.5px">
                © ${new Date().getFullYear()} NAVAL BATTLE - TOUS DROITS RÉSERVÉS
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;

    const html = this.compileTemplate(mjmlTemplate);

    await this.resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: email,
      subject: 'Vérification de votre email - Naval Battle',
      html,
    });
  }

  /**
   * Envoie un email de bienvenue après vérification
   */
  async sendWelcomeEmail(email: string, username: string): Promise<void> {
    const logoUrl = process.env.LOGO_URL || '';

    const mjmlTemplate = `
      <mjml>
        <mj-head>
          <mj-title>Bienvenue sur Naval Battle</mj-title>
          <mj-preview>Votre compte est maintenant activé !</mj-preview>
          <mj-attributes>
            <mj-all font-family="'Georgia', 'Times New Roman', serif"></mj-all>
            <mj-text font-weight="400" font-size="16px" color="#000000" line-height="24px" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#ffffff">
          <!-- Header -->
          <mj-section background-color="#000000" padding="30px 20px">
            <mj-column>
              ${logoUrl ? `<mj-image src="${logoUrl}" alt="Naval Battle" width="120px" align="center" padding-bottom="10px"></mj-image>` : ''}
              <mj-text align="center" color="#ffffff" font-size="28px" font-weight="normal" letter-spacing="2px">
                NAVAL BATTLE
              </mj-text>
            </mj-column>
          </mj-section>

          <!-- Main Content -->
          <mj-section background-color="#ffffff" padding="50px 40px">
            <mj-column>
              <mj-text font-size="22px" font-weight="normal" color="#000000" align="center" padding-bottom="30px">
                Bienvenue à bord
              </mj-text>
              
              <mj-divider border-color="#000000" border-width="1px" padding="0 0 30px 0"></mj-divider>
              
              <mj-text font-size="16px" color="#000000" line-height="26px" padding-bottom="15px">
                Bonjour ${username},
              </mj-text>
              
              <mj-text font-size="16px" color="#000000" line-height="26px" padding-bottom="30px">
                Votre compte est maintenant activé. Vous pouvez dès à présent accéder à l'ensemble 
                des fonctionnalités de Naval Battle.
              </mj-text>

              <!-- Features -->
              <mj-text font-size="15px" color="#000000" line-height="28px" padding-bottom="30px">
                • Créer ou rejoindre des parties<br/>
                • Gagner des points ELO et grimper dans le classement<br/>
                • Suivre vos statistiques et vos victoires<br/>
                • Communiquer avec vos adversaires en jeu
              </mj-text>

              <mj-button 
                background-color="#000000" 
                color="#ffffff" 
                font-size="14px" 
                font-weight="normal"
                letter-spacing="1px"
                padding="35px 0px"
                border-radius="0px"
                href="${process.env.FRONTEND_URL}"
                inner-padding="12px 40px"
              >
                COMMENCER À JOUER
              </mj-button>
              
              <mj-divider border-color="#e0e0e0" border-width="1px" padding="40px 0 30px 0"></mj-divider>
              
              <mj-text font-size="14px" color="#000000" line-height="22px" padding-top="10px">
                <strong>Conseils stratégiques</strong>
              </mj-text>
              
              <mj-text font-size="14px" color="#666666" line-height="24px" padding-top="15px">
                Placez vos navires de manière réfléchie, variez vos tirs pour localiser 
                les bâtiments adverses et maintenez une série de victoires pour améliorer votre classement.
              </mj-text>
            </mj-column>
          </mj-section>

          <!-- Footer -->
          <mj-section background-color="#f5f5f5" padding="30px 40px">
            <mj-column>
              <mj-text align="center" color="#666666" font-size="12px" line-height="20px">
                Pour toute question, n'hésitez pas à nous contacter.
              </mj-text>
              
              <mj-divider border-color="#cccccc" padding="25px 0 20px 0"></mj-divider>
              
              <mj-text align="center" color="#999999" font-size="11px" letter-spacing="0.5px">
                © ${new Date().getFullYear()} NAVAL BATTLE - TOUS DROITS RÉSERVÉS
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;

    const html = this.compileTemplate(mjmlTemplate);

    await this.resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: email,
      subject: 'Bienvenue sur Naval Battle',
      html,
    });
  }

  /**
   * Envoie un email de réinitialisation de mot de passe
   */
  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const logoUrl = process.env.LOGO_URL || '';

    const mjmlTemplate = `
      <mjml>
        <mj-head>
          <mj-title>Réinitialisation de mot de passe</mj-title>
          <mj-preview>Réinitialisez votre mot de passe Naval Battle</mj-preview>
          <mj-attributes>
            <mj-all font-family="'Georgia', 'Times New Roman', serif"></mj-all>
            <mj-text font-weight="400" font-size="16px" color="#000000" line-height="24px" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#ffffff">
          <!-- Header -->
          <mj-section background-color="#000000" padding="30px 20px">
            <mj-column>
              ${logoUrl ? `<mj-image src="${logoUrl}" alt="Naval Battle" width="120px" align="center" padding-bottom="10px"></mj-image>` : ''}
              <mj-text align="center" color="#ffffff" font-size="28px" font-weight="normal" letter-spacing="2px">
                NAVAL BATTLE
              </mj-text>
            </mj-column>
          </mj-section>

          <!-- Main Content -->
          <mj-section background-color="#ffffff" padding="50px 40px">
            <mj-column>
              <mj-text font-size="22px" font-weight="normal" color="#000000" align="center" padding-bottom="30px">
                Réinitialisation de mot de passe
              </mj-text>
              
              <mj-divider border-color="#000000" border-width="1px" padding="0 0 30px 0"></mj-divider>
              
              <mj-text font-size="16px" color="#000000" line-height="26px" padding-bottom="25px">
                Bonjour,
              </mj-text>
              
              <mj-text font-size="16px" color="#000000" line-height="26px" padding-bottom="30px">
                Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous 
                pour définir un nouveau mot de passe.
              </mj-text>

              <mj-button 
                background-color="#000000" 
                color="#ffffff" 
                font-size="14px" 
                font-weight="normal"
                letter-spacing="1px"
                padding="35px 0px"
                border-radius="0px"
                href="${resetUrl}"
                inner-padding="12px 40px"
              >
                RÉINITIALISER MON MOT DE PASSE
              </mj-button>

              <mj-text font-size="14px" color="#666666" line-height="22px" padding-top="40px">
                Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :
              </mj-text>

              <mj-text font-size="13px" color="#000000" line-height="22px" padding-top="10px" padding-bottom="30px">
                ${resetUrl}
              </mj-text>
              
              <mj-divider border-color="#e0e0e0" border-width="1px" padding="30px 0"></mj-divider>
              
              <mj-text font-size="14px" color="#000000" line-height="22px" padding-top="20px">
                <strong>Important</strong>
              </mj-text>
              
              <mj-text font-size="14px" color="#666666" line-height="22px" padding-top="15px">
                Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email. 
                Votre mot de passe actuel restera inchangé.
              </mj-text>
            </mj-column>
          </mj-section>

          <!-- Footer -->
          <mj-section background-color="#f5f5f5" padding="30px 40px">
            <mj-column>
              <mj-text align="center" color="#666666" font-size="12px" line-height="20px">
                Ce lien de réinitialisation expire dans 1 heure.
              </mj-text>
              
              <mj-divider border-color="#cccccc" padding="25px 0 20px 0"></mj-divider>
              
              <mj-text align="center" color="#999999" font-size="11px" letter-spacing="0.5px">
                © ${new Date().getFullYear()} NAVAL BATTLE - TOUS DROITS RÉSERVÉS
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;

    const html = this.compileTemplate(mjmlTemplate);

    await this.resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: email,
      subject: 'Réinitialisation de votre mot de passe - Naval Battle',
      html,
    });
  }
}
