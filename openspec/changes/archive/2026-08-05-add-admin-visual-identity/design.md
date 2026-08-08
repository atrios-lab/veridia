# Design: Configurações — aba Identidade Visual

## Context

A parte 1 da Entrega 4 deixou pronta a casca do painel, a tela `/admin/configuracoes` com a faixa
de quatro abas e a camada de override do tenant (`tenant_content`, chave `office-contact`, mesclada
em `getTenant()`). Esta parte implementa a seção **1b** do design aprovado: a aba Identidade Visual.

Restrições que moldam tudo o que vem abaixo:

- **Nenhum hex fora de `@theme`** (`scripts/check-tokens.mjs`). Os cinco estilos já existem em
  `globals.css` como blocos `[data-theme="..."]` que definem `--brand-*`, e os utilitários
  `bg-brand-primary` e afins resolvem em tempo de uso.
- **O painel é estética fixa da plataforma.** Os tokens `--palette-admin-*` são deliberadamente
  desacoplados do tema do tenant.
- **Regra no núcleo, I/O no transporte.** Gating e mescla de override são funções puras em
  `src/core/tenant`; banco e arquivo ficam em `src/lib`.
- **Esconder controle não é controle de acesso.** Toda checagem se repete no servidor.
- O CSP é montado por request em `src/middleware.ts` com `img-src 'self' data: blob:`.

## Goals / Non-Goals

**Goals:**

- Implementar a seção 1b fielmente: estilo, logotipo, página inicial (foto, dois textos, seções) e
  a prévia ao vivo, com "Salvar e publicar" e "Descartar mudanças".
- Fazer a aba caber na arquitetura existente sem inventar camada nova: mesmo `tenant_content`,
  mesmo `applyTenantOverrides`, mesmo `audit_log`.
- Fechar a fronteira de gravação no schema, não em `if`s espalhados.

**Non-Goals:**

- Abas Encarregado e Cobrança; rascunho editorial; recorte de imagem; seletor de cor livre; envio
  de fonte; envio do selo; painel tematizado. Todos justificados na proposta.

## Decisions

### 0. Permissão é `branding.edit`, não `content.edit`

`src/core/auth/roles.ts` já declara `branding.edit` como permissão própria, concedida a `admin` e
negada a `staff` — ao contrário de `content.edit`, que os dois papéis têm. A aba Serventia (parte
1) usa `content.edit` porque horário e contato são operacionais, algo que quem atende o balcão
edita. Estilo, logotipo e o que aparece na home são decisão de quem responde pela serventia; a
permissão certa já existia, só não tinha tela nenhuma que a usasse. `saveOfficeContact` continua
com `content.edit`.

### 1. Rota própria por aba, faixa compartilhada

`/admin/configuracoes/identidade-visual` é um segmento novo; a faixa de abas sai das páginas para
`configuracoes/_components/tabs.tsx`, marcando a aba corrente por `usePathname`. Duas abas viram
links; Encarregado e Cobrança continuam `<span aria-disabled>`.

Alternativa descartada: uma página só com estado de aba no cliente. A tela tem envio de arquivo,
prévia e gravação atômica próprios — misturar os dois formulários numa página multiplicaria o
estado sem ganhar nada, e a URL deixaria de nomear a tela.

### 2. Um formulário cliente, uma server action, gravação atômica

A aba inteira é um `"use client"` com estado local (`useState`) para estilo, textos, seções e
arquivos escolhidos, enviado por `useActionState` numa única server action. É o que a prévia
exige: ela reage antes de qualquer gravação, então o estado não publicado tem de existir no
navegador.

"Descartar mudanças" reinicia o estado a partir das props vindas do servidor e remonta o
formulário por `key`, o que também limpa os `<input type="file">`. Sair da tela sem publicar perde
o rascunho — é o que a proposta assume e o texto da tela diz.

### 3. A prévia é `data-theme` sobre os tokens que já existem

A caixa da prévia é `<div data-theme={estiloEscolhido} className="font-serif ...">` usando
`bg-brand-primary`, `text-brand-on-dark-heading` e companhia. Trocar o estilo é trocar um atributo:
zero CSS novo, zero hex, zero classe por tema, e o escopo do tema morre na borda da caixa — o
painel ao redor continua nos `--palette-admin-*`.

Alternativa descartada: gerar utilitários `bg-tema-marinho-primary` para os cinco temas. Seriam ~55
tokens novos para desenhar cinco amostras de cor, e as amostras dos cartões de estilo resolvem-se
pelo mesmo truque (cada cartão embrulhado no próprio `data-theme`).

As cinco serifadas (Spectral, Libre Baskerville, Lora, Bitter, Cormorant Garamond) saem de
`(public)/layout.tsx` para `src/lib/fonts.ts` e são aplicadas nesta tela — todas as cinco, porque a
tela mostra os cinco nomes na letra de cada um e a prévia troca de letra ao vivo. É a única rota do
painel que carrega fonte de tenant.

### 4. Override novo é `pick`, e o `pick` é a fronteira

`src/core/tenant/schema.ts` ganha um bloco `home` (`eyebrow`, `title`), com os valores de hoje como
padrão — a frase literal do hero e `subtitle` — para que nenhuma configuração existente quebre.

```
OfficeBrandSchema = TenantSchema.pick({ theme, logos, heroImage, home, disabledSections })
```

Mesma técnica do `OfficeContactSchema`: o que não está no `pick` não é gravável, então `cns`,
`name` e `attributions` numa gravação forjada são descartados pelo parse, sem branch defensivo para
alguém esquecer. `disabledSections` ganha um `refine` contra o conjunto de seções opcionais.

O override é gravado em `published` (a coluna `draft` segue sem uso): "Salvar e publicar" é a
publicação.

### 5. Seções obrigatórias, declaradas duas vezes de propósito

`src/core/tenant/gating.ts` ganha `MANDATORY_SECTIONS` (`inicio`, `dpo-lgpd`, `ouvidoria`,
`transparencia`) e `isSectionEnabled` passa a ignorar o desligamento de qualquer uma delas. O
`refine` do schema recusa a gravação; o gating garante que uma linha escrita à mão no banco também
não derruba um canal exigido por lei. Uma das duas é redundante no dia feliz — a redundância é o
ponto.

### 6. Duas chaves de override, uma consulta

`readOfficeContact` vira `readTenantOverrides`, que lê `office-contact` e `office-brand` com um
`inArray` e devolve as duas linhas. Sem isso, `getTenant()` — chamado por praticamente toda rota —
passaria de uma para duas idas ao banco por request. `applyTenantOverrides` recebe os dois blobs e
aplica os dois parses independentes: um blob corrompido continua sendo ignorado sozinho, sem
derrubar o outro nem o site.

### 7. Imagens: arquivo entra, URL nunca

A action aceita **apenas arquivos**, jamais um caminho de imagem vindo do navegador. Campo de
arquivo vazio significa "mantém o que está publicado". Aceitar a URL atual num campo escondido
seria dar a qualquer sessão com `content.edit` o poder de apontar o logotipo da serventia para um
endereço arbitrário; o CSP barraria a exibição, mas o dado gravado já estaria errado.

`storeBrandImage` entra em `src/lib/uploads.ts`, ao lado de `storeAttachments`, reaproveitando a
mesma escolha de destino: **Vercel Blob** quando há `BLOB_READ_WRITE_TOKEN` (o deploy), **disco** em
desenvolvimento. Diferença em relação aos anexos do cidadão: estas imagens precisam de URL pública,
então em desenvolvimento vão para `public/uploads/marca/` (servido pelo próprio Next) e não para
`var/uploads`, que existe para arquivo que nunca deve chegar ao navegador. Nome com UUID, então
publicar uma imagem nova nunca esbarra em cache da anterior.

Validação no servidor, antes de escrever qualquer arquivo: tipo (`image/png`, `image/jpeg`,
`image/webp`), tamanho (1 MB para logotipo, 4 MB para o hero) e o lote inteiro recusado se um
arquivo falhar — mesma disciplina de `storeAttachments`, pelo mesmo motivo: envio recusado não
pode deixar meio arquivo para trás.

O host do Blob entra em `next.config.ts` (`images.remotePatterns`) e no `img-src` do CSP, **como
host exato, nunca curinga**. A prévia da foto recém-escolhida usa `URL.createObjectURL`, que o
`blob:` já presente no `img-src` cobre.

Alternativa descartada: servir as imagens do Blob por um route handler nosso, para manter
`img-src 'self'`. É um proxy no caminho quente de todo visitante para servir um arquivo estático.

### 8. O desvio do cartão de logotipo

O design desenha um botão "Trocar logotipo"; o tenant tem `logos.light` e `logos.dark`. Um PNG
qualquer não produz os dois, e escolher um só deixa o outro errado em metade das superfícies. O
cartão mantém o desenho e a prévia e recebe as duas trocas rotuladas, cada prévia sobre o fundo em
que a versão é usada. O selo fica de fora: é favicon, marca d'água e a marca do próprio painel —
identidade institucional, não escolha estética.

## Risks / Trade-offs

- **Tema de tenant dentro do painel** → a prévia é a única superfície do painel que renderiza
  `--brand-*`, e só dentro da caixa com `data-theme`. Nenhum utilitário `brand-*` fora dela; o
  restante da tela segue em `admin-*`.
- **`img-src` deixa de ser só `'self'`** → host exato do Blob, sem curinga, e nada mais.
- **Prévia é uma maquete, não a home real** → ela desenha a mesma estrutura da home num formato de
  celular, e vai divergir se a home mudar. O caminho honesto seria um `<iframe>` da home com o
  rascunho aplicado, o que exige uma sessão de pré-visualização que não existe. Assumido: a prévia
  responde por estilo, textos, foto e seções, que é o que a pessoa está escolhendo.
- **Imagens antigas ficam órfãs no Blob** → publicar substitui a URL e não apaga a anterior.
  Assumido e marcado no código: são poucos arquivos por serventia, e apagar cedo demais é como se
  perde a imagem que ainda está no ar em cache.
- **Sem validação de dimensão** → o texto pede 1600 px de largura e o servidor não confere; foto
  pequena vira hero feio, nunca site quebrado.
- **Segunda chave por request** → resolvida pela consulta única; se `tenant_content` crescer para
  muitas chaves, vira leitura de todas as chaves da serventia numa consulta só.
- **`public/uploads/` em desenvolvimento** → entra no `.gitignore`. No deploy o caminho é o Blob;
  sem `BLOB_READ_WRITE_TOKEN` em produção o envio falharia contra um sistema de arquivos efêmero, e
  o token já é requisito dos anexos do cidadão.

## Migration Plan

Sem migração de banco: `tenant_content` e `audit_log` já existem, e a chave nova é uma linha a mais.
`TenantSchema` ganha `home` com padrão, então configuração de serventia existente continua válida
sem edição. Rollback é reverter o deploy: uma linha `office-brand` deixada para trás passa a ser
ignorada, e a serventia volta ao que está em código.

## Open Questions

Nenhuma bloqueante. Duas para decidir quando houver uso real: se a limpeza de imagens órfãs vale um
job, e se a prévia deve virar `<iframe>` da home real quando existir sessão de pré-visualização.
