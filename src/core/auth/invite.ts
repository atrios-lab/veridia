// The text of the two account e-mails (convite, nova senha), as data: no
// HTML, no I/O. src/lib/email renders this into a message and sends it —
// this module only decides what it says, in Portuguese, so it can be tested
// without a network or a database.

export interface AccountEmailText {
  subject: string;
  paragraphs: readonly string[];
  buttonLabel: string;
  footnote: string;
}

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

export type AccountEmailInput = InviteEmailInput | PasswordResetEmailInput;

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
