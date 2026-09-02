## Context

O valor do pedido vive em `serviceRequests.amountCents` (coluna nullable,
`src/db/schema.ts:144`). Hoje só existe caminho de escrita: `setRequestAmount`
(`src/lib/service-request.ts:924-943`) roda `UPDATE ... SET amountCents = <number>` e recebe
`amountCents: number` — a assinatura não aceita `null`. A action `setAmountAction`
(`src/app/admin/(dashboard)/pedidos/[protocolo]/actions.ts:256-295`) valida a entrada com
`parseCentsInput` (`src/core/request/money.ts:20-28`), que devolve `undefined` para string vazia
e a action trata isso como erro ("Informe um valor válido."). A UI
(`amount-section.tsx:29-63`) só tem o botão "Informar valor"/"Corrigir valor"; não existe botão
de remover.

## Goals / Non-Goals

**Goals:**
- Permitir voltar `amountCents` para `null` a partir de um valor já informado, com o mesmo nível
  de proteção (auth + audit) que já existe para corrigir.
- Reaproveitar o componente e a action existentes em vez de criar uma tela/rota nova.

**Non-Goals:**
- Não muda quem pode informar/corrigir/remover (mesma autorização de operador da serventia).
- Não adiciona confirmação extra (modal, senha) além do que já existe hoje para corrigir valor.
- Não muda o formato de moeda nem a máscara de entrada.

## Decisions

- **Reaproveitar `setRequestAmount` com `amountCents: number | null`** em vez de criar uma função
  `clearRequestAmount` separada: é o mesmo UPDATE, só muda o valor gravado, e mantém uma única
  entrada de gravação para auditar. Alternativa descartada: função separada — duplicaria a
  chamada de `recordAudit` sem ganho.
- **Botão "Remover valor" ao lado de "Corrigir valor"**, visível só quando `amountCents !== null`,
  chamando a mesma `setAmountAction` com um sinal explícito (ex.: campo hidden `intent=clear`) em
  vez de reinterpretar string vazia como remoção — string vazia continua sendo erro de input
  (evita remover por engano ao limpar o campo sem querer confirmar).
- **Histórico**: `recordAudit` já registra a ação `service-request.amount` para toda gravação de
  valor; a remoção grava a mesma ação com `amountCents: null`, sem precisar de um novo tipo de
  entrada — o histórico já mostra "—" quando o valor gravado é null.

## Risks / Trade-offs

- [Remover some com o e-mail "valor a consultar" já enviado ao cidadão, criando confusão se o
  valor for removido depois] → aceitável: mesmo risco já existe hoje ao corrigir o valor para
  outro número; fora de escopo desta mudança.
- [Intent explícito no form exige tocar o componente client, não só a action] → mitigado por ser
  um botão a mais no mesmo form, sem novo estado de UI.
