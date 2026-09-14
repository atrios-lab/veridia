## 1. RejectedCard

- [x] 1.1 Remover o parágrafo "Se ficou alguma dúvida, fale com a gente pelo atendimento online ou
      no balcão. Estamos aqui para ajudar." de `RejectedCard` (`protocol-trilho.tsx`).
- [x] 1.2 Adicionar `<Link href="/solicitar" className="btn btn-primary">Refazer pedido</Link>`
      fora da condicional `isRejected`, para aparecer nos dois desfechos (Indeferido e Cancelado).
- [x] 1.3 Confirmar que a linha "Você pode refazer o pedido, cobrindo o que motivou o
      indeferimento." continua exclusiva do ramo `isRejected` (Indeferido).

## 2. Verificação

- [x] 2.1 Rodar o app localmente e visitar `/acompanhar` com um pedido indeferido (via seed ou
      fixture existente) para conferir o botão, o link para `/solicitar` e o layout do card.
- [x] 2.2 Conferir o mesmo card para um pedido cancelado: botão presente, sem a linha de
      indeferimento.
- [x] 2.3 Rodar lint/typecheck do projeto sobre o arquivo alterado.
