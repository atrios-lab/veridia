# Proposta: Configurações — aba Identidade Visual (Entrega 4, parte 2)

## Why

A aba **Identidade Visual** é hoje um rótulo inerte na faixa de abas de `/admin/configuracoes`,
marcada "em breve". É a aba que a parte 1 prometeu e não entregou, e é a única tela do produto em
que a promessa da plataforma — *customização é configuração, nunca fork* — fica visível para quem
paga por ela. Enquanto ela não existe, trocar o estilo do site, o logotipo, a foto de abertura ou
desligar uma seção da home exige commit, revisão e deploy: tudo isso é `config-as-code` em
`src/core/tenant/tenants/*.ts`, e nada disso é decisão de desenvolvedor. É decisão da serventia.

O redesign aprovado ("Redesign 04 - Admin Config, Usuários e Senha", projeto
`558c4556-caed-4f30-9c6b-648f995805cf`, seção **1b**) desenha a tela inteira, com prévia ao vivo e
o par "Salvar e publicar" / "Descartar mudanças". Esta proposta implementa a seção 1b fielmente.

## What Changes

- **Nova rota `/admin/configuracoes/identidade-visual`.** A faixa de abas vira navegação de
  verdade: Serventia e Identidade Visual são links; Encarregado e Cobrança seguem inertes e
  rotuladas "em breve". A faixa sai das duas páginas para um componente compartilhado.
- **Bloco "Estilo do site"**: os cinco estilos (Verde & Dourado, Marinho & Bronze, Vinho & Pérola,
  Grafite & Cobre, Oliva & Terracota) como cartões selecionáveis, cada um com as três amostras de
  cor da própria paleta e **o nome escrito na letra do próprio estilo** — a pessoa vê a diferença
  em vez de ler "Lora + Public Sans". Grava `theme`.
- **Bloco "Logotipo"**: prévia do logotipo atual e envio de um PNG novo (até 1 MB).
  - **Desvio assumido do design:** o cartão desenhado tem um único botão "Trocar logotipo", e o
    tenant tem duas versões do logotipo (fundo claro e fundo escuro). Um PNG qualquer não gera as
    duas: logotipo branco em cabeçalho branco é logotipo invisível. O cartão mantém o desenho e a
    prévia, com duas trocas rotuladas dentro dele — uma por versão, cada uma sobre um fundo que
    mostra onde ela é usada. O **selo** (favicon, marca d'água, sidebar do painel) segue
    config-as-code: não é escolha estética, é a identidade institucional da serventia.
- **Bloco "Página inicial"**: foto do hero (envio de imagem), **frase de destaque** e **título de
  boas-vindas** — os dois textos hoje estão presos no código (`"Serviços notariais e de registro"`
  literal e `tenant.subtitle`) e passam a ser campos, com os valores de hoje como padrão.
- **Bloco "Seções do site"**: interruptores para as seções opcionais que a atribuição da serventia
  concede. Seções obrigatórias por lei ou institucionais (Início, Canal LGPD, Ouvidoria,
  Transparência) aparecem com cadeado e **não têm interruptor** — pela mesma razão que as
  atribuições da aba Serventia viraram tique na parte 1: controle que não controla é promessa que
  a tela não cumpre. Grava `disabledSections`.
- **Prévia ao vivo** (coluna direita, fixa): a home no celular, reagindo na hora a estilo, textos,
  foto e seções — antes de qualquer gravação. É a prévia que justifica a tela ser um formulário só,
  com estado no cliente.
- **"Salvar e publicar" e "Descartar mudanças"**: a aba inteira é uma gravação atômica. Nada vai ao
  ar antes do botão; descartar volta ao que está publicado. Uma server action, uma linha em
  `tenant_content` (chave `office-brand`), um registro em `audit_log`, e o site público
  revalidado.
- **Envio de imagens**: primeira escrita de arquivo do painel. Vercel Blob no deploy, disco em
  desenvolvimento, validação de tipo e tamanho no servidor, e o host do Blob liberado no CSP e no
  `next/image`.

## Capabilities

### New Capabilities

- `admin-visual-identity`: a aba Identidade Visual — o que a serventia escolhe sobre a própria
  aparência (estilo, logotipo, foto e textos de abertura, seções visíveis), o que ela não escolhe
  (seções obrigatórias, selo, atribuições), como a prévia se relaciona com o publicado, e a
  fronteira de validação do que chega do navegador.

### Modified Capabilities

Nenhuma. `openspec/specs/` continua vazio: as capacidades das entregas anteriores (`admin-shell`,
`admin-office-settings`, `public-home`, `tenant-config`) ainda vivem como delta em mudanças não
arquivadas. Os requisitos que esta mudança acrescenta ao hero da home e à camada de override do
tenant ficam na spec nova, com nota de origem.

## Não-objetivos

- **Abas Encarregado e Cobrança.** Cada uma é um fluxo próprio, com dado sensível (chave Pix) e
  regra própria. Seguem "em breve" na faixa.
- **Cor ou fonte fora dos cinco estilos.** Escolher paleta é escolher um dos cinco blocos que já
  existem em `globals.css`. Não há seletor de cor, não há envio de fonte, e nenhum hex novo entra
  no repositório — a regra do `check:tokens` vale para esta tela como para qualquer outra.
- **Painel tematizado pela serventia.** Decisão já tomada e reafirmada: o painel é estética fixa da
  plataforma. Trocar o estilo repinta o site público, nunca o painel.
- **Recorte, redimensionamento ou validação de dimensão da imagem.** O texto de ajuda pede
  "horizontal, mínimo 1600 px" e o servidor confere apenas tipo e tamanho. Uma foto pequena vira um
  hero ruim, não um site quebrado. Fica registrado como limitação conhecida.
- **Envio do selo** (favicon, marca d'água, sidebar do painel).
- **Rascunho de verdade.** "Salvar e publicar" grava em `published`; a coluna `draft` de
  `tenant_content` continua sem uso. O estado não publicado vive no navegador de quem edita, e é o
  que a prévia mostra — recarregar a página perde o que não foi publicado, e isso é o esperado.
- **Reordenar seções, renomear seções ou editar qualquer texto do site além dos dois do hero.**
- **Tornar `attributions`, nome ou CNS editáveis.** Continua valendo o que a parte 1 decidiu.
- **Tela de Usuários e tela de Trocar senha** (as outras duas telas da Entrega 4).

## Impact

- **Código novo**: `src/app/admin/(dashboard)/configuracoes/identidade-visual/` (página,
  formulário cliente, prévia, action), o componente de faixa de abas em
  `src/app/admin/(dashboard)/configuracoes/`, e `storeBrandImage` em `src/lib/uploads.ts`.
- **Código alterado**:
  - `src/core/tenant/schema.ts` — novo bloco `home` (`eyebrow`, `title`), com os valores de hoje
    como padrão.
  - `src/core/tenant/overrides.ts` — segundo schema de override (`OfficeBrandSchema`) e a mescla
    correspondente. Continua sendo `pick` sobre `TenantSchema`: o que não está no pick não é
    gravável, e `attributions` segue fora.
  - `src/core/tenant/gating.ts` — conjunto explícito de seções obrigatórias, que um override não
    consegue desligar nem por gravação forjada.
  - `src/lib/tenant.ts` — passa a ler as **duas** chaves de override numa consulta só, não uma por
    chave.
  - `src/app/(public)/page.tsx` e `(public)/layout.tsx` — hero lê os dois textos do tenant; o mapa
    de fontes serifadas por estilo sai do layout para um módulo compartilhado, reaproveitado pela
    aba e pela prévia.
  - `next.config.ts` e `src/middleware.ts` — host do Blob no `next/image` e no `img-src` do CSP.
  - `src/app/admin/(dashboard)/configuracoes/page.tsx` — a menção à aba vira link.
- **Banco**: nenhuma migração. `tenant_content` e `audit_log` já existem.
- **Dependências**: nenhuma nova (`@vercel/blob` já está instalado, usado pelos anexos do cidadão).
- **Riscos a vigiar**: (1) a prévia ao vivo é o primeiro componente do painel que renderiza tokens
  `--brand-*` de tenant — se vazar estilo do tenant para fora da caixa da prévia, o painel deixa de
  ser fixo; (2) o `img-src` do CSP hoje é `'self' data: blob:` e passa a admitir um host externo,
  que precisa ser exatamente o do Blob, não um curinga; (3) desligar uma seção retira rota do ar
  para o cidadão — por isso a lista de obrigatórias é dupla, no schema e no gating.
- **Testes**: `node --test` para o override novo (estilo inválido recusado, seção obrigatória não
  desligável, campo forjado descartado) e para o gating; Playwright para "trocar o estilo no painel
  e ver a home pública mudar", "desligar uma seção e ela sumir da navegação" e "seção obrigatória
  não tem interruptor".
