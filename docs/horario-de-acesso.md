# Horário de acesso ao painel

Decisão de 11/11/2026: o painel só abre das **07:00 às 18:00**, horário de
Brasília, para quem não tem liberação do Tabelião/Registrador. Fora desse
horário, ninguém da equipe vê os dados da serventia de casa, sem autorização
expressa.

## Quem entra a qualquer hora

- O Tabelião/Registrador.
- A conta da plataforma (Átrios).
- Quem o Tabelião/Registrador liberou em Configurações › Equipe e acesso ›
  **Horário de acesso**:
  - **Liberar só hoje**: vale até a meia-noite.
  - **Liberar sempre**: vale até ele retirar.

## O que a pessoa vê fora do horário

Aparece a tela "Acesso indisponível neste horário", com o horário de
funcionamento e o aviso da LGPD (Lei nº 13.709/2018, arts. 6º, VII, e 46). Se
ela precisar acompanhar uma demanda, escreve qual é e clica em "Pedir
liberação ao Tabelião/Registrador".

O pedido aparece para o Tabelião/Registrador numa faixa em todas as telas
("1 pessoa pediu para acessar o painel fora do horário"). Ele libera só hoje,
libera sempre ou recusa.

Uma tela que já estava aberta avisa 10 minutos antes do fim e, no horário,
recarrega na tela fechada.

## Como é garantido

- O bloqueio fica em `getSession()` (`src/lib/session.ts`). Por isso vale para
  telas, ações e downloads, não só para o menu.
- `getClosedHoursSession()` serve apenas à tela fechada e ao pedido de
  liberação.
- As regras puras e os testes ficam em `src/core/auth/access-hours.ts`.
- A configuração (horário, liberados e pedidos) fica em `tenant_content`, na
  chave `office-access-hours`. Não houve mudança na estrutura do banco.
- O Tabelião/Registrador pode mudar o horário ou desligar o limite na mesma
  tela.

## Auditoria

| Ato | Faixa |
|---|---|
| Pedido | Atenção |
| Liberação | Atenção |
| Retirada | Análise |
| Recusa | Rotina |
| Mudança do horário | Atenção |
