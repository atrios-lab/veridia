## Why

O menu do site público não diz em que página o visitante está. Aberto na Transparência,
"Transparência" aparece igual a todas as outras opções: sem destaque e sem `aria-current`. Num
celular, onde o menu cobre o conteúdo enquanto está aberto, é a única referência disponível — e
ela não existe.

Apareceu no print que o cartório enviou junto do SCRUM-8. Aquele card tinha duas metades: o menu
que não fechava em aparelhos sem a API popover, já corrigido, e "não consegue ver o que
selecionou", que é esta. Registrada como SCRUM-20.

A barra do painel já resolve isso desde sempre (`admin-shell`, "Navegação só oferece o que existe
e o que a pessoa pode acessar"). O site público ficou para trás.

## What Changes

- O link da rota atual no menu do site passa a ser marcado com `aria-current="page"` e a receber
  destaque visual; os demais permanecem como estão.
- Vale para o menu do celular e para a navegação do cabeçalho no desktop, que listam as mesmas
  seções.
- A marcação acompanha navegação no cliente, sem recarregar a página.
- Nada muda em quais itens aparecem: o gating por seção habilitada continua exatamente como é.

## Capabilities

### New Capabilities

Nenhuma. A mudança altera requisito de uma capacidade que já existe.

### Modified Capabilities

- `public-site-foundation`: o shell público passa a marcar a seção atual na navegação, além de
  esconder as seções desabilitadas.

## Impact

- `src/app/(public)/layout.tsx`: a `<nav id="site-menu">` e a navegação do cabeçalho.
- Um componente cliente novo para os links, ou a promoção da lista a cliente: o layout público é
  servidor e não é recriado numa navegação de cliente (ver `design.md`).
- `src/core/tenant/gating.ts` não muda: `sectionNavLinks` já devolve o href de cada link.

## Non-Goals

- **O rodapé não muda.** A navegação secundária lá é lista de atalhos, não indicação de lugar, e
  marcar a página atual no rodapé não ajuda ninguém a se localizar.
- Não se mexe em quais seções aparecem nem no gating que decide isso.
- Não se muda o desenho do menu: nem tamanho, nem posição, nem o botão que abre.
- Não se acrescenta migalha de pão (breadcrumb) nem título de seção nas páginas.
