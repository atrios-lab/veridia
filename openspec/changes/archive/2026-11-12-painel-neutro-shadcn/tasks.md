O grupo 2 vai direto para a `main`, porque não muda nada na tela. Os grupos 3 a 13 são PRs
para o branch de integração `painel-neutro`; a produção não vê nada deles. O grupo 14 é a
entrega: uma PR só do branch de integração para a `main`, com tudo pronto. A `main` é trazida
para o branch de integração todo dia, seguida de `pnpm check:admin-scale -- --update`. A
bateria do `CLAUDE.md` roda inteira antes de abrir cada PR. Nenhuma tarefa toca o banco.

## 1. Antes de começar

- [x] 1.1 Confirmar com o dono do projeto as duas premissas da decisão 7 do design: prévias do site dentro do painel continuam tematizadas; PDFs e e-mails continuam com a marca do cartório
- [x] 1.2 Folha de tokens: o usuário dispensou a aprovação prévia; valores do protótipo, `muted-foreground` decidido pelo teste de contraste
- [x] 1.3 Arquivar a change `admin-redesign-7a-v2`, que está com as 26 tarefas feitas
- [x] 1.4 Conferir o `logos.seal.light` de cada serventia cadastrada sobre a tinta da barra lateral e listar as que precisam de arquivo novo
- [x] 1.5 Criar o branch `claude/painel-neutro` a partir da `main` (um branch só, commit por etapa, PR única no fim, por decisão do usuário)

## 2. Trava do CI, direto na `main`

- [x] 2.1 Escrever a função pura de contagem e comparação com a linha de base, com teste em `node --test` (arquivo novo, arquivo que piora, arquivo que melhora, arquivo isento)
- [x] 2.2 Criar `scripts/check-admin-scale.ts` com a opção `--update` que só reduz, e gerar `scripts/admin-scale-baseline.json`
- [x] 2.3 Adicionar `pnpm check:admin-scale` ao `package.json`, a `.github/workflows/verify.yml` e à bateria do `CLAUDE.md`

## 3. Fundação: duas raízes, folha de estilo e componentes

- [x] 3.1 Extrair o `generateMetadata` de `src/app/layout.tsx` para um auxiliar em `src/lib`, com teste em `node --test` cobrindo título, canônico, ícone e cartão social
- [x] 3.2 Transformar `src/app/(public)/layout.tsx` em raiz (`<html lang="pt-BR">`, `<body>`, Public Sans, `globals.css`) e apagar `src/app/layout.tsx`
- [x] 3.3 Transformar `src/app/admin/layout.tsx` em raiz: sem `data-theme`, sem serifada, com IBM Plex Sans (400, 500, 600) e `admin.css`, mantendo o `noindex` e o `Toaster`
- [x] 3.4 Criar `src/app/admin/admin.css` com `@import "tailwindcss" source(none)`, os `@source` do painel e os tokens da decisão 3 dentro de `@theme`
- [x] 3.5 Ponte de legado dentro de `admin.css`: `--color-admin-*` e `--brand-*` da raiz em valores neutros, `--font-brand-serif` apontando para a Plex e as variantes `.btn-admin-*` repintadas
- [x] 3.6 Separar a folha: o conteúdo de `globals.css` foi para `brand.css`, importado pelo site (`globals.css`) e, durante a ponte, pelo painel (`admin.css`, com `@source not "../(public)"`); a detecção de fontes do site ficou como estava, para não arriscar classe faltando no site
- [x] 3.7 Metadados das duas raízes saem do mesmo `rootMetadata` (teste em `src/lib/root-metadata.test.ts`); conferir o `<head>` no Preview antes da PR final
- [x] 3.8 Conferir no host do cartório de demonstração que nenhuma tela do painel ficou sem estilo e que o site público não mudou
- [x] 3.9 Escrever o teste de contraste que lê `admin.css` e exige 4,5:1 nos pares de texto e fundo, inclusive sobre `muted` e sobre a tinta da barra lateral
- [x] 3.10 Criar `components.json` apontando para `src/app/admin/_ui`, criar `cn.ts` e instalar as dependências com versão fixa
- [x] 3.11 Adicionar ao Biome a regra que impede `src/app/(public)` de importar `src/app/admin/_ui`

## 4. Casca

- [x] 4.1 Adicionar `Sidebar` a `_ui` e ajustar: borda em vez de "inset", rótulo em duas linhas, tinta navy
- [x] 4.2 Reescrever `sidebar.tsx`, `sidebar-nav.tsx` e `locked-sidebar.tsx` sobre o `Sidebar`, com `logos.seal.light`, sem mudar `nav.ts` nem as regras de permissão
- [x] 4.3 Reescrever `top-bar.tsx` e `user-menu.tsx` (busca, estado do chat, pessoa logada) com os componentes novos
- [x] 4.4 Reescrever `page-header.tsx` e `back-link.tsx` na escala de letra, mantendo o link "Como usar esta tela"
- [x] 4.5 Migrar as telas de acesso: `login`, `esqueci-senha`, `redefinir-senha`, `confirmar-email` e `acesso`
- [x] 4.6 Conferir que `nav.test.ts` continua passando e que `aria-current="page"` acompanha a navegação no cliente
- [x] 4.7 Conferir a casca no celular (gaveta do menu) e pelo teclado

## 5. Primitivos

- [x] 5.1 Adicionar a `_ui`: `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Field`, `Label`, com imports no padrão do projeto e texto em português
- [x] 5.2 Adicionar a `_ui`: `Dialog`, `AlertDialog`, `DropdownMenu`, `Popover`, `Tooltip`
- [x] 5.3 Adicionar a `_ui`: `Tabs` (sublinhadas), `Table`, `Badge` (com as variantes de atenção e sucesso), `Alert`, `Card`, `Progress`, `Kbd`
- [x] 5.4 Trocar `dialog.tsx` e `confirm-action.tsx` por `Dialog` e `AlertDialog`, conferindo foco ao abrir, `Esc` e retorno do foco
- [x] 5.5 Trocar `dropdown.tsx`, `checkbox.tsx`, `submit-button.tsx`, `password-field.tsx`, `tax-id-input.tsx` e `file-picker.tsx`
- [x] 5.6 Reescrever `global-search.tsx` com `Dialog` e o gatilho no visual do protótipo, mantendo `Ctrl K` e a busca atual (sem `cmdk`)
- [x] 5.7 Aplicar o tema novo ao `sonner` e remover as classes de notificação antigas
- [x] 5.8 Migrar os avisos compartilhados: `agenda-alerts`, `chat-alerts`, `guide-alerts`, `record-alerts`, `urgent-audit-banner`, `access-closed`, `request-files-notice`
- [x] 5.9 Tirar as animações contínuas do painel e conferir o comportamento com movimento reduzido
- [x] 5.10 Rodar `pnpm check:admin-scale -- --update` e conferir que a linha de base de `_components` zerou

## 6. Telas: Visão geral

- [x] 6.1 Migrar `(dashboard)/page.tsx` e os componentes dela seguindo a prancha "Visão geral" do canvas, sem mudar o que cada bloco conta
- [x] 6.2 Baixar a linha de base e anexar captura à PR

## 7. Telas: Pedidos

- [x] 7.1 Migrar a fila (`pedidos`) seguindo a prancha "Fila de pedidos": abas sublinhadas, tabela, paginação
- [x] 7.2 Migrar o detalhe (`pedidos/[protocolo]`) e o lançamento (`pedidos/novo`), com campo de data nativo
- [x] 7.3 Baixar a linha de base e anexar captura à PR

## 8. Telas: Agenda

- [x] 8.1 Migrar `agenda` e `agenda/agendamento/[id]`, com `Calendar` só onde a tela mostra calendário
- [x] 8.2 Baixar a linha de base e anexar captura à PR

## 9. Telas: Atendimento e Mensagens

- [x] 9.1 Migrar `atendimento` e `mensagens`, mantendo o aviso sonoro e a atualização ao vivo
- [x] 9.2 Baixar a linha de base e anexar captura à PR

## 10. Telas: Ouvidoria e LGPD

- [x] 10.1 Migrar `ouvidoria` e `lgpd` (fila e detalhe)
- [x] 10.2 Baixar a linha de base e anexar captura à PR

## 11. Telas: Publicações e Transparência

- [x] 11.1 Migrar `publicacoes` e `transparencia`, deixando a prévia de Publicações com o tema da serventia dentro da caixa
- [x] 11.2 Baixar a linha de base e anexar captura à PR

## 12. Telas: Configurações, Usuários e Minha conta

- [x] 12.1 Migrar `configuracoes` (todas as abas), `usuarios` e `minha-conta`
- [x] 12.2 Conferir que a prévia e o seletor de estilo de Identidade Visual continuam tematizados e que o painel ao redor não muda ao trocar o estilo
- [x] 12.3 Baixar a linha de base e anexar captura à PR

## 13. Telas restantes e fechamento

- [x] 13.1 Migrar `auditoria`, `adequacao`, `utilitarios`, `atrios`, `ajuda`, `documento` e `search`
- [x] 13.2 Tirar a ponte: o painel importa só `brand-palettes.css` (paletas para as prévias); saem de `brand.css` os `--color-admin-*`, os `--palette-admin-*`, as `.btn-admin-*`, a `.checkbox-admin` e as animações só do painel. `AdminIcon` fica, como mapa para lucide
- [x] 13.3 Apagar `scripts/admin-scale-baseline.json` e tornar a trava absoluta, mantendo a lista de prévias isentas
- [x] 13.4 Reescrever `docs/design-system.md`: site e painel em seções separadas, tokens, escalas, componentes de `_ui`, o que é proibido e por quê
- [x] 13.5 Corrigir o contexto de `openspec/config.yaml`, que ainda diz que o painel herda o tema do tenant
- [ ] 13.6 Listar os vídeos de treinamento que mostram a aparência antiga, para regravação (pendente fora do código: os vídeos estão no banco de produção)
- [x] 13.7 Rodar a bateria completa no branch de integração

## 14. Entrega

- [x] 14.1 Trazer a `main` uma última vez e conferir o painel rodando no host do cartório de demonstração (feito no local contra o Homolog, em 12/11/2026)
- [ ] 14.2 (pendente, com o usuário) Avisar as serventias, antes do merge, que o painel muda de aparência e que nada muda no funcionamento
- [x] 14.3 Abrir a PR única para a `main` com a bateria completa (PR #293, merge em 12/11/2026)
- [x] 14.4 Depois do merge, sincronizar as specs e arquivar a change
