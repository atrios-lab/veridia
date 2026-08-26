// The text of the account e-mails (convite, nova senha, troca de e-mail e o
// aviso de que ela aconteceu), as data: no
// HTML, no I/O. src/lib/email renders this into a message and sends it:
// this module only decides what it says, in Portuguese, so it can be tested
// without a network or a database.

import type { EmailText } from "../email/text.ts";

export type AccountEmailText = EmailText;

interface InviteEmailInput {
  kind: "convite";
  recipientName: string;
  inviterName: string;
  roleLabel: string;
}

interface PasswordResetEmailInput {
  kind: "nova-senha";
  recipientName: string;
}

/** Sent to the address being moved to, never to the one in use. */
interface EmailChangeEmailInput {
  kind: "troca-email";
  recipientName: string;
  currentEmail: string;
}

/** Sent to the address being left behind, after the change is done. */
interface EmailChangedNoticeInput {
  kind: "email-alterado";
  recipientName: string;
  newEmail: string;
}

export type AccountEmailInput =
  | InviteEmailInput
  | PasswordResetEmailInput
  | EmailChangeEmailInput
  | EmailChangedNoticeInput;

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

export function buildAccountEmailText(
  input: AccountEmailInput,
): AccountEmailText {
  const name = firstName(input.recipientName);

  if (input.kind === "convite") {
    return {
      subject: "Seu acesso ao painel administrativo",
      paragraphs: [
        `Olá, ${name}. ${input.inviterName} criou uma conta para você no ` +
          `painel administrativo da serventia, com o papel de ${input.roleLabel}.`,
        "Clique abaixo para criar a sua senha. Só você vai conhecê-la.",
      ],
      buttonLabel: "Criar minha senha",
      footnote:
        "O link vale 48 horas e só funciona uma vez. Se você não esperava " +
        "este e-mail, é só ignorá-lo. Nenhuma conta será usada sem a " +
        "senha que você criar.",
    };
  }

  if (input.kind === "troca-email") {
    return {
      subject: "Confirme o novo e-mail do painel",
      paragraphs: [
        `Olá, ${name}. A serventia pediu para mudar o e-mail da sua conta do ` +
          `painel administrativo para este endereço.`,
        `Até você confirmar, sua conta continua entrando com ${input.currentEmail}. ` +
          "Sua senha não muda.",
      ],
      buttonLabel: "Confirmar novo e-mail",
      footnote:
        "O link vale 48 horas e só funciona uma vez. Se você não esperava " +
        "este e-mail, é só ignorá-lo: sem a confirmação, nada muda.",
    };
  }

  if (input.kind === "email-alterado") {
    return {
      subject: "O e-mail da sua conta do painel mudou",
      paragraphs: [
        `Olá, ${name}. O e-mail da sua conta do painel administrativo passou ` +
          `a ser ${input.newEmail}. É por ele que você entra a partir de agora.`,
        "Sua senha continua a mesma.",
      ],
      buttonLabel: "Entrar no painel",
      footnote:
        "Se não foi você quem pediu essa mudança, avise a serventia agora: " +
        "este endereço não entra mais na conta.",
    };
  }

  return {
    subject: "Crie uma nova senha para o painel",
    paragraphs: [
      `Olá, ${name}. Foi pedida uma nova senha para a sua conta do painel administrativo.`,
    ],
    buttonLabel: "Criar nova senha",
    footnote:
      "O link vale 48 horas. Sua senha atual continua valendo até você " +
      "criar a nova. Se não foi você quem pediu, avise a serventia.",
  };
}
