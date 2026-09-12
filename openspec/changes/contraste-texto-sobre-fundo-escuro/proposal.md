## Why

O `check:a11y` reprova o tenant `bentofernandes` (tema `oliva-terracota`) em todas as páginas
públicas e em `/admin/login` e `/admin/esqueci-senha`, sempre pelo mesmo motivo: texto pequeno
sobre o fundo escuro da marca com contraste abaixo de 4,5:1 (WCAG AA). Os outros quatro temas
passam. Foi encontrado ao incluir `/plataforma` na varredura (PR #108) e não vem dessa change:
o mesmo elemento já falhava em `/` e `/privacidade`.

Duas causas, medidas com a fórmula do WCAG sobre os tokens de `src/app/globals.css`:

- **Site público, linha de créditos do rodapé** (`text-brand-on-dark-muted`, 12 px, sobre
  `bg-brand-primary`). O token é derivado: 62% de branco misturado ao primário do tema. O
  primário do oliva (`#3f4f2e`) é o mais claro dos cinco, e a mistura cai em 4,5:1 no limite
  (4,56 pela conta, abaixo de 4,5 no que o navegador computa). Nos outros temas fica entre
  5,8 e 6,2.
- **Painel de login e "esqueci a senha"** (`text-admin-on-dark-muted`, 12 px, sobre
  `bg-admin-primary`). O fundo passou a ser o primário do tenant quando o painel adotou a marca
  publicada (spec `admin-auth`, "Tela de login com identidade da serventia"), mas o token do
  texto ficou fixo em `#8fa896`, um verde desenhado para o verde-dourado. Sobre o oliva dá
  3,47:1; nos outros temas, entre 4,8 e 5,3.

## What Changes

- `--brand-on-dark-muted` passa de 62% para 70% de branco na mistura com o primário, para os
  cinco temas: o oliva sobe para 5,3:1 e os demais para 7,5 a 8,4. Continua abaixo de
  `--brand-on-dark-body` (86%), então a hierarquia entre corpo e apagado se mantém. Um
  ajuste só, na derivação, em vez de um override por tema: o comentário do arquivo diz que a
  derivação "garante que o tom derivado sempre pertence à paleta de onde veio", e é isso que
  se preserva.
- `--color-admin-on-dark-muted` deixa de apontar para a cor fixa `#8fa896` e passa a
  `var(--brand-on-dark-muted)`, como já fazem `--color-admin-primary` e
  `--color-admin-on-dark-accent`: o painel repinta com o tenant, e o apagado sobre o fundo
  escuro tem que repintar junto. `--palette-admin-on-dark-muted` é removido; o ponto da bolinha
  do `live-chat-card`, que usa o mesmo token sobre o mesmo fundo, acompanha.
- `check:a11y` passa nos cinco temas, incluindo `/plataforma`, `/admin/login` e
  `/admin/esqueci-senha` (as duas últimas já estão na varredura? conferir; se não, entram).
- **BREAKING**: nenhuma. Só cor de texto apagado sobre fundo escuro, um pouco mais clara.

## Capabilities

### Modified Capabilities
- `public-site-foundation`: "Tema do site público por configuração do tenant" passa a exigir
  que todo texto sobre o fundo escuro da marca atinja 4,5:1 em todos os temas oferecidos.
- `admin-auth`: "Tela de login com identidade da serventia" passa a exigir que os tons
  apagados do painel derivem do tema, não de uma cor fixa, com o mesmo mínimo de contraste.

## Impact

- `src/app/globals.css`: a linha de `--brand-on-dark-muted`, a de `--color-admin-on-dark-muted`
  e a remoção de `--palette-admin-on-dark-muted`.
- `scripts/check-a11y.mjs`: `/admin/esqueci-senha` na lista de rotas, se ainda não estiver.
- `src/lib/palette.test.ts` compara `palette.ts` com o CSS: os tokens tocados não estão em
  `Palette` (são derivados), então nada muda ali; conferir que continua passando.
- Sem migração, sem mudança de componente.

## Non-Goals

- Rever o contraste de textos sobre fundo claro, ou de temas que já passam.
- Criar um token por tema para o apagado: a derivação resolve e mantém a regra de "um tema é
  uma paleta, nunca CSS".
