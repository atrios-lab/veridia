## Context

O transporte (`src/lib/email/send.ts`), o template de aviso (`renderNoticeEmailHtml`) e a política de melhor esforço (`notifyCitizen` em `src/lib/email/service-request.ts`) já existem e já servem quatro eventos do pedido. Este change só adiciona chamadas em quatro server actions que hoje criam ou alteram um protocolo em silêncio. `notifyCitizen` já resolve sozinho os casos de borda: contato nulo, telefone e ausência de host — nada a checar nos chamadores.

## Goals / Non-Goals

**Goals:**
- Recibo ao protocolar LGPD, ouvidoria identificada e pedido de balcão, quando o contato é e-mail.
- Aviso quando o valor do pedido é informado pela primeira vez.
- Mesma regra de sempre: protocolo no e-mail, chave e conteúdo jamais; falha de envio nunca falha a ação.

**Non-Goals:**
- Confirmação de cancelamento pelo cidadão, aviso de formulário de exigência, lembrete de véspera, "esqueci minha senha" (itens deliberadamente fora, ver exploração).
- Qualquer mudança em `src/lib/email/*`.

## Decisions

- **Reusar `notifyCitizen` verbatim** em todos os quatro pontos. Alternativa considerada: um builder próprio por canal (LGPD, OUV) — rejeitada, o corpo é uma frase e o shell do aviso já é neutro por desenho.
- **"Valor informado" só na primeira vez.** `setAmountAction` avisa apenas quando o pedido não tinha valor (o registro devolvido por `findById` antes do set, ou o retorno de `setRequestAmount` se já expuser o valor anterior — decidir na implementação pelo que custar menos uma query). Correção de valor não reavisa: reavisar cada ajuste de centavos viraria ruído, exatamente o critério do cenário "Prenotado não avisa".
- **Ouvidoria: nenhum `if` novo no chamador.** `notifyCitizen` já ignora contato ausente; manifestação anônima não tem contato. O padrão já usado em `ouvidoria/[protocolo]/actions.ts` (comentário na linha 68) vale aqui também.
- **Texto dos recibos** segue o do `/solicitar`: "Recebemos…, guarde o protocolo e a chave mostrados na tela". No balcão, "mostrados no atendimento" — a chave foi entregue em papel/na tela do atendente.

## Risks / Trade-offs

- [Aviso de valor sem o valor no corpo] → coerente com a regra "sem conteúdo"; o cidadão consulta com a chave e vê o valor e o Pix. Se a serventia reclamar, é uma frase a mudar num único lugar.
- [Recibo do balcão pode surpreender quem não esperava e-mail] → o operador só registra o contato que o cidadão deu; o recibo é o comportamento que o canal público já tem.
