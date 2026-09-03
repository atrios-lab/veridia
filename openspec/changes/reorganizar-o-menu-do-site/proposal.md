## Why

No desktop, quatro páginas que o cartório oferece só existem no rodapé: Canal LGPD, Ouvidoria,
Transparência e Selo digital. Quem procura a ouvidoria precisa rolar a página inteira para achar
o link. E "Centrais", que aparece na barra, não diz o que é a quem nunca abriu a página.

No celular o menu é uma lista de onze itens na ordem interna do gating: "Canal LGPD" vem em
segundo lugar, antes de "Solicitar serviço" e "Agendar atendimento", que são as duas tarefas que
trazem o cidadão ao site.

No tablet a barra completa não cabe. Em 768px, medido no Cartório Marinho, o cabeçalho tem 807px
de conteúdo numa janela de 768px: a página rola para o lado e "Solicitar serviço" quebra em duas
linhas.

## What Changes

- A barra do desktop passa a ser Início, Serviços, Cidadão, Contato e Transparência, mais o
  botão de consulta. "Serviços" e "Cidadão" abrem um submenu com as páginas do grupo que a barra
  não mostra sozinha, cada uma com uma linha dizendo o que é.
- O menu do celular lista as mesmas páginas nos mesmos grupos, com "Início" no topo, e passa a
  rolar por dentro quando a tela é mais baixa que a lista.
- O rodapé, o menu do celular e os submenus da barra leem uma única lista de grupos.
- A barra completa só aparece a partir de 1024px. Entre 768px e 1023px vale o menu do celular. Os
  rótulos da barra não quebram mais linha.
- A descrição de cada seção passa a viver em `src/core/tenant/gating.ts`, ao lado do rótulo, e a
  home lê de lá em vez de repetir o texto.

## Capabilities

### New Capabilities

Nenhuma. A mudança altera requisito de uma capacidade que já existe.

### Modified Capabilities

- `public-site-foundation`: toda seção habilitada passa a ser alcançável a partir do cabeçalho,
  agrupada por tarefa, sem depender do rodapé; a barra completa não pode estourar a largura da
  tela em nenhum viewport.

## Impact

- `src/app/(public)/layout.tsx`: a barra, os submenus, o menu do celular e o rodapé.
- `src/app/(public)/_components/nav-links.tsx`: a descrição opcional sob cada link.
- `src/app/globals.css`: onde um submenu se pendura (ancoragem por CSS).
- `src/core/tenant/gating.ts`: `SECTION_DESCRIPTIONS` e a descrição em `sectionNavLinks`.
- `src/app/(public)/page.tsx`: os cards da home leem a descrição do núcleo.
- `e2e/public-nav.spec.ts`: a barra, os submenus e o tablet.

## Non-Goals

- **Não se mexe no gating.** Quais seções existem, e para quem, continua exatamente como é.
- **Não se renomeia seção nenhuma.** "Centrais" continua "Centrais"; a descrição é o que passa a
  explicar o nome.
- **A barra do painel administrativo não muda.** Ela já agrupa e já tem busca global.
- **Não se acrescenta busca ao site público.** Onze páginas não pedem uma.
- **O rodapé continua sem marcar a página atual.** Ali é atalho, não localização.
