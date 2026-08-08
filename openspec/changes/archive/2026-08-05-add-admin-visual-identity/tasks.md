## 1. Núcleo: schema, override e gating

- [x] 1.1 Em `src/core/tenant/schema.ts`, acrescentar o bloco `home` ao `TenantSchema`
      (`eyebrow` e `title`, ambos `z.string().min(1)`), com `.default()` reproduzindo os valores
      de hoje: a frase literal do hero e o `subtitle` da serventia — configuração existente tem
      de continuar válida sem edição
      **Desvio:** só `eyebrow` levou `.default()` — é a mesma frase para toda serventia hoje.
      `title` não tem default de schema porque hoje já varia por serventia (era `subtitle`), e um
      default de Zod não pode ler outro campo do mesmo objeto; `home.title` ficou obrigatório e
      foi escrito explicitamente em `marinho.ts` e `aurora.ts`, reproduzindo o `subtitle` de cada
      um.
- [x] 1.2 Em `src/core/tenant/gating.ts`, declarar `MANDATORY_SECTIONS` (`inicio`, `dpo-lgpd`,
      `ouvidoria`, `transparencia`) e exportar `optionalSections(tenant)`, que devolve as seções
      concedidas pela atribuição e não obrigatórias — é a lista que a aba desenha com interruptor
- [x] 1.3 `isSectionEnabled` passa a ignorar `disabledSections` para seção obrigatória: uma linha
      escrita à mão no banco não derruba canal exigido por lei
- [x] 1.4 Em `src/core/tenant/overrides.ts`, criar `OfficeBrandSchema` como
      `TenantSchema.pick({ theme, logos, heroImage, home, disabledSections })`, com `refine` em
      `disabledSections` recusando seção obrigatória; versão parcial para leitura, como em
      `OfficeContactOverrideSchema`
- [x] 1.5 `applyTenantOverrides` passa a receber os dois blobs (contato e marca) e aplicar os dois
      parses independentes — blob corrompido de um não invalida o outro nem o tenant
- [x] 1.6 Testes `node --test` em `src/core/tenant/overrides.test.ts`: estilo fora dos cinco
      recusado; seção obrigatória em `disabledSections` recusada; `attributions`/`cns` injetados
      descartados; override de marca ausente ou corrompido devolve a configuração intacta
- [x] 1.7 Testes em `src/core/tenant/tenant.test.ts`: seção obrigatória continua ativa mesmo
      listada como desligada; `optionalSections` não devolve seção que a atribuição não concede

## 2. Leitura das duas chaves de override

- [x] 2.1 Em `src/lib/tenant.ts`, exportar `OFFICE_BRAND_KEY` e trocar `readOfficeContact` por
      uma leitura única com `inArray` das duas chaves, devolvendo os dois blobs
- [x] 2.2 `getTenant()` aplica os dois overrides; o `try/catch` que cai para a configuração em
      código quando o banco falha continua cobrindo a consulta inteira

## 3. Envio de imagens

- [x] 3.1 Em `src/lib/uploads.ts`, criar `storeBrandImage(file, kind)`: valida tipo
      (`image/png`, `image/jpeg`, `image/webp`) e tamanho (1 MB para logotipo, 4 MB para hero)
      **antes** de escrever, nomeia com UUID e devolve a URL pública
      (validação pura em `src/core/tenant/brand-image.ts`, mesmo padrão de `attachment.ts`)
- [x] 3.2 Destino: Vercel Blob quando há `BLOB_READ_WRITE_TOKEN`, senão `public/uploads/marca/`
      — não `var/uploads`, que existe para arquivo que nunca deve chegar ao navegador. Comentar
      a diferença no código
- [x] 3.3 Acrescentar `public/uploads/` ao `.gitignore`
- [x] 3.4 Liberar o host exato do Blob em `next.config.ts` (`images.remotePatterns`) e no
      `img-src` do CSP em `src/middleware.ts` — host exato, nunca curinga
      **Nota:** o host não é fixo (é um id gerado pelo Blob Store), então virou a variável de
      ambiente `BLOB_PUBLIC_HOST`, documentada em `.env.example`; ausente, `img-src` não cresce.
- [x] 3.5 Teste `node --test` da validação pura (tipo aceito, tipo recusado, limite por espécie),
      sem tocar disco nem rede

## 4. Fontes compartilhadas

- [x] 4.1 Extrair de `src/app/(public)/layout.tsx` o mapa de serifadas por estilo para
      `src/lib/fonts.ts` (as cinco instâncias `next/font` e o `Record<Theme, ...>`), sem mudar o
      comportamento do layout público
- [x] 4.2 O layout público passa a importar de lá; conferir que continua servindo uma única
      serifada por request

## 5. Faixa de abas compartilhada

- [x] 5.1 Criar `configuracoes/_components/tabs.tsx`: Serventia e Identidade Visual como `Link`,
      Encarregado e Cobrança inertes com "em breve" e não focáveis, aba corrente por
      `usePathname` com `aria-current="page"`
      **Achado durante a implementação:** a permissão certa da aba Identidade Visual é
      `branding.edit` (ver design.md, decisão 0), não `content.edit` — a faixa agora oferece cada
      aba pela permissão correspondente, mesma regra "esconder é cortesia, o servidor sempre
      confere" do `admin/_components/nav.ts`
- [x] 5.2 `configuracoes/page.tsx` passa a usar a faixa compartilhada e a menção a "Identidade
      Visual" no rodapé do bloco de atribuições vira link (só para quem tem `branding.edit`)

## 6. Server action de publicação

- [x] 6.1 Criar `identidade-visual/actions.ts` com `saveVisualIdentity`: sessão + `branding.edit`
      checados no servidor antes de qualquer leitura de arquivo (permissão corrigida — ver 5.1)
- [x] 6.2 Ler do `FormData` apenas estilo, os dois textos, as seções desligadas e os **arquivos**;
      nunca aceitar URL de imagem vinda do navegador — campo de arquivo vazio significa "mantém o
      que está publicado"
- [x] 6.3 Enviar as imagens presentes, montar o objeto completo e validar com `OfficeBrandSchema`;
      erro de validação devolve mensagens por campo. **Desvio:** valores de texto/estilo/seções são
      ecoados via estado controlado no cliente (o formulário nunca perde o que a pessoa digitou,
      controlado ou não); arquivos não são ecoados — o navegador não repopula um `<input
      type="file">`, e a pessoa escolhe de novo, custo aceito e documentado no código
- [x] 6.4 Gravar em `published` na chave `office-brand` com `onConflictDoUpdate`, registrar
      `office-brand.save` em `audit_log` e `revalidatePath("/", "layout")`
- [x] 6.5 Falha de banco não publica pela metade: nada gravado, mensagem genérica, formulário
      preservado

## 7. Tela: blocos do design

- [x] 7.1 `identidade-visual/page.tsx` (servidor): checa `branding.edit`, lê o tenant e entrega ao
      formulário cliente, que deriva a lista de seções (obrigatórias e opcionais) do próprio tenant
- [x] 7.2 Bloco "Estilo do site": cinco cartões acessíveis por teclado (grupo de rádio nativo,
      `role="radiogroup"` com `aria-label`), cada um embrulhado no próprio `data-theme` para as três
      amostras de cor, e o nome do estilo na serifada correspondente
- [x] 7.3 Bloco "Logotipo": prévia das duas versões, cada uma sobre o fundo em que é usada, com
      uma troca rotulada por versão. Desvio do design documentado em design.md, decisão 8
- [x] 7.4 Bloco "Página inicial": foto do hero com prévia por `URL.createObjectURL`, campos
      "Frase de destaque" e "Título de boas-vindas"
- [x] 7.5 Bloco "Seções do site": interruptor para as opcionais; obrigatórias com cadeado e sem
      controle algum, com o motivo escrito antes da lista
- [x] 7.6 Barra final: "Salvar e publicar", "Descartar mudanças" (remonta o formulário por `key`,
      limpando também os campos de arquivo) e a frase de que nada vale antes de publicar
- [x] 7.7 Estado de sucesso e de erro no padrão do painel (`output` de confirmação, `role="alert"`
      para a falha)

## 8. Prévia ao vivo

- [x] 8.1 Criar o componente de prévia: maquete da home no formato de celular, embrulhada em
      `data-theme` e usando apenas utilitários `brand-*` dentro da caixa
- [x] 8.2 A prévia reflete estilo, serifada, os dois textos, a foto escolhida e as seções ligadas,
      antes de qualquer gravação; coluna fixa (`sticky`) como no design
- [x] 8.3 Conferir que nenhum utilitário `brand-*` escapa da caixa — o painel ao redor continua em
      `admin-*` (conferido por leitura: só `preview.tsx` e as amostras de `ThemeCard` usam `brand-*`)

## 9. Site público lê o que foi publicado

- [x] 9.1 `src/app/(public)/page.tsx`: hero passa a usar `tenant.home.eyebrow` e
      `tenant.home.title` no lugar da frase literal e de `subtitle`
- [x] 9.2 Conferir que estilo, logotipos, foto e seções publicados já chegam pela mescla de
      `getTenant()`, sem alteração no layout público além do import de fontes

## 10. Verificação

- [x] 10.1 `pnpm lint`, `pnpm typecheck`, `pnpm check:tokens` e `pnpm test` limpos.
      `check:tokens` é o que garante que nenhum hex novo entrou junto com a tela.
      **`check:dashes`:** limpo em todo arquivo tocado por esta mudança; as falhas restantes
      (`src/middleware.ts`, `src/core/scheduling/calendar.ts`, `src/app/admin/_components/sidebar.tsx`,
      `src/app/admin/(dashboard)/page.tsx`, `e2e/admin-settings.spec.ts`) são travessões
      pré-existentes de trabalho anterior não commitado, fora do escopo desta mudança
- [x] 10.2 E2E `e2e/admin-visual-identity.spec.ts`: trocar o estilo no painel e ver a home pública
      mudar (serifada computada); desligar uma seção opcional e sua rota virar 404; seção
      obrigatória sem nenhum controle. 7/7 passando contra o servidor de desenvolvimento
- [x] 10.3 E2E: publicar texto de hero e conferir na home; descartar mudanças devolve o formulário
      ao publicado sem gravar (e sem o texto aparecer no site). Faixa de abas com link real e
      `aria-current`. Visitante sem sessão é recusado antes de qualquer checagem de permissão
- [x] 10.4 Tela conferida no navegador em 1440, logada como o admin semeado: faixa de abas, os
      cinco cartões de estilo com nome na própria serifada, logotipo (duas versões), página
      inicial (foto, dois textos, seções com cadeado nas obrigatórias), barra de publicação e
      prévia ao vivo reagindo antes de publicar — todos batendo com a seção 1b do design.
      Publicação real testada de ponta a ponta (estilo, título, seção desligada) e o estado do
      tenant de demonstração foi restaurado ao original ao final
