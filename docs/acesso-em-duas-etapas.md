# Acesso ao painel em duas etapas

1. A pessoa entra com e-mail e senha.
2. O painel envia um código de 6 dígitos **ao e-mail dessa pessoa**, que vale por 10 minutos, e abre a tela
   `/admin/acesso`.
3. Com o código certo, o painel libera o acesso até a sessão terminar (8 horas). Um novo login pede outro
   código.

## Regras

- **Primeiro acesso:** criar a senha pelo convite, ou redefinir a senha, não pede código, porque o link já
  veio por e-mail. O código começa no acesso seguinte.
- **Salvar este computador:** na tela do código, a pessoa pode marcar a opção. Aquele navegador deixa de
  pedir o código por até um ano.
- **Configurações › Duas etapas** (só o administrador):
  - escolher, trocar ou apagar o e-mail de verificação de cada pessoa. Apagado, o código volta para o
    e-mail da conta;
  - "Pedir o código de novo nos computadores salvos": vale a partir do próximo login daquela pessoa.
- **Minha conta** (menu com o nome, no alto da tela): cada pessoa troca **só o próprio** e-mail de
  verificação. O e-mail novo é confirmado com um código enviado a ele antes de valer.
- **Átrios:** a conta mestre da Átrios (superadmin) não passa pelo código.

## Como é garantido

- **Ponto único:** `getSession` (`src/lib/session.ts`) recusa a sessão sem a confirmação. Como toda tela,
  ação e rota do painel passa por ele, nenhuma fica de fora.
- **Cookies assinados:** o código, a confirmação e o computador salvo ficam em cookies `httpOnly` assinados
  (HMAC, com chave derivada de `BETTER_AUTH_SECRET`). Ver `src/lib/access-code.ts` e `src/lib/email-code.ts`.
- **Escolhas do administrador:** ficam em `tenant_content` (`office-access-codes`), com auditoria.
- **Tentativas:** cinco códigos errados bloqueiam a pessoa por 10 minutos (Upstash, o mesmo limitador do
  login).

## Liberação de acesso (só a Átrios)

A conta mestre da Átrios tem a tela **Átrios › Liberação de acesso**. Nela dá para desligar ou religar a
verificação em duas etapas de qualquer serventia, com um motivo, sem afetar as outras e sem mexer na Vercel.
Cada mudança fica na auditoria da serventia.

## Emergência

Se o provedor de e-mail (Postmark) cair para todas as serventias, ninguém recebe o código. Para liberar o acesso só com a senha
enquanto isso, defina `PANEL_ACCESS_CODE=off` nas variáveis da Vercel e faça um novo deploy. Remova a
variável assim que o e-mail voltar.
