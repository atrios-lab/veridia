## Context

`/admin/agenda` é uma Server Component que decide entre dois estados por `hasGrid(config)`. O
aviso de grade vazia carrega o único `<Link href="/admin/agenda/configuracao">` do repositório
(confirmado por grep em `src/`), então o estado configurado não tem porta para a configuração. A
sidebar (`src/app/admin/_components/nav.ts`) lista apenas `/admin/agenda`, e o
`AdminPageHeader` é compartilhado por todas as telas do painel e aceita só `title`.

A tela de configuração já tem o caminho inverso: um `‹ Voltar para a agenda` no topo do `<main>`,
com `text-[12.5px] font-semibold text-admin-accent underline`. O que falta é o par dele.

## Goals / Non-Goals

**Goals:**

- Um caminho permanente e visível da agenda do dia para a configuração da agenda.
- Diff mínimo, contido em um arquivo de página, sem tocar em componentes compartilhados.
- Simetria com o link de volta que a tela de configuração já usa.

**Non-Goals:**

- Item novo na sidebar, abas na rota da agenda, ou slot de ação no `AdminPageHeader`.
- Qualquer mudança em `src/core/scheduling`, nas Server Actions ou no site público.
- Regras novas sobre salvar uma grade vazia.

## Decisions

**Link permanente no topo do `<main>` de `/admin/agenda`, alinhado à direita.**

Estilizado como os botões secundários que o painel já usa (`rounded-lg border
border-admin-border ... hover:bg-admin-input-bg`), não como link inline sublinhado: é uma ação
da tela, e o padrão de botão existente é o que carrega os tokens de cor do tenant. Fica acima
da navegação de datas, fora do bloco condicional do aviso, e portanto independente de
`hasGrid`. Sem shadcn: o repositório não o usa em lugar nenhum, e um segundo design system por
causa de um botão contraria o próprio design system do painel.

Alternativas descartadas:

- *Item na sidebar*: `nav.ts` documenta os nove itens como o design aprovado, e a configuração
  da agenda é subordinada à agenda, não irmã das outras seções. Um décimo item pagaria caro por
  um problema de uma tela só.
- *Slot de ação no `AdminPageHeader`*: o componente é `async`, busca os próprios dados e serve
  todas as telas; ganhar uma prop de ação por causa de uma tela é superfície nova em código
  compartilhado.
- *Abas "Dia · Configuração"*: modelo mental melhor, diff bem maior, e nada aqui exige a
  reestruturação. Fica disponível se a agenda ganhar uma terceira tela.

**O aviso de grade vazia continua com o botão dele.** O aviso não é redundante: ele é o empurrão
para quem nunca configurou, com o texto que explica a consequência ("o site pede que o cidadão
ligue"). Só deixa de ser a única porta.

## Risks / Trade-offs

- [Duas chamadas para o mesmo destino na tela vazia] → Deliberado, e visualmente distintas: o
  aviso é um bloco de alerta com explicação, o link do topo é navegação discreta. O cenário de
  grade vazia na spec cobre exatamente essa coexistência.
- [Regressão silenciosa no futuro: alguém remove o link achando que o aviso basta] → O teste e2e
  com a grade preenchida falha se o caminho sumir.
