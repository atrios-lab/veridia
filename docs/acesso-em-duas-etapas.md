# Acesso ao painel em duas etapas

1. A pessoa entra com e-mail e senha.
2. O painel envia um código de 6 dígitos ao e-mail da conta, que vale por 10 minutos, e abre a tela
   `/admin/acesso`.
3. Com o código certo, o painel libera o acesso até a sessão terminar. Um novo login pede outro código.

## Como é garantido

- **Ponto único:** `getSession` (`src/lib/session.ts`) recusa a sessão sem a confirmação. Como toda tela,
  ação e rota do painel passa por ele, nenhuma fica de fora.
- **Nada no banco:** o código e a confirmação ficam em cookies `httpOnly` assinados (HMAC, com chave derivada
  de `BETTER_AUTH_SECRET`) e ligados à sessão (`src/lib/access-code.ts`, `src/lib/email-code.ts`).
- **Tentativas:** cinco códigos errados bloqueiam a pessoa por 10 minutos. Usa o Upstash, o mesmo
  limitador do login.

## Emergência

Se o provedor de e-mail (Postmark) cair, ninguém recebe o código. Para liberar o acesso só com a senha
enquanto isso, defina `PANEL_ACCESS_CODE=off` nas variáveis da Vercel e faça um novo deploy. Remova a
variável assim que o e-mail voltar.
