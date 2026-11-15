## Context

A plataforma já tem quase tudo o que o encarregado usa, espalhado em três lugares:

- **Requerimentos LGPD** (`/admin/lgpd`), com prazo de 15 dias e resposta protegida por chave;
- **Adequação ao Provimento** (`/admin/adequacao`), cujo núcleo (`src/core/compliance/`) calcula
  classe, subclasse e prazos do art. 16 e do art. 20 do Provimento 213 com a redação do 243;
- **Encarregado** (`/admin/configuracoes/encarregado`).

Falta quem tire as dúvidas. O projeto ainda não tem nenhuma integração de IA.

Pontos fixos que moldam o desenho:

- A CSP do painel é `connect-src 'self'`. O navegador só fala com a própria origem.
- Toda regra vive no núcleo puro (`src/core`), testável com `node --test`.
- Desde 11/11/2026, cada ferramenta nova tem a sua permissão, que nasce copiando outra
  (`DERIVED_FROM`).
- O ritmo por endereço ou por pessoa usa Upstash, que fica desligado no desenvolvimento local e
  na CI.
- Já existe uma rotina diária autenticada por `CRON_SECRET` (`/api/agenda/lembretes`), que o
  painel também chama ao abrir.
- Todas as serventias são do RN. O fuso é `America/Fortaleza` (`OFFICE_TIME_ZONE`).

Decisões do usuário em 15/11/2026:

- todos que usam a plataforma usam o assistente;
- está incluído, sem cobrança;
- a Átrios vê as conversas;
- só perguntas genéricas, sem enviar o conteúdo do requerimento;
- um aviso para não enviar dados, e ocultação automática se a pessoa enviar mesmo assim. Nas
  palavras do usuário, "sobre os dados é só não vazar".

Os padrões que propus foram aceitos: teto de 300 por mês por serventia, cada pessoa vê só as
suas conversas e guarda por 12 meses.

## Goals / Non-Goals

**Goals**

- Um assistente que só fala de proteção de dados, responde com base em normas citadas e conhece
  a situação da serventia.
- Nenhum dado pessoal sai do servidor da plataforma nem fica gravado na conversa.
- Custo previsível para a Átrios: triagem barata, teto por serventia e ritmo por pessoa.
- Rascunho de resposta no requerimento LGPD sem enviar nada do titular.

**Non-Goals.** Valem os da proposta: PDF e assinatura, conteúdo do requerimento, cidadão, mover
telas, busca na internet, nomes com garantia, parecer jurídico e cobrança.

## Decisions

### 1. Fluxo de uma pergunta

```
 navegador ── POST /api/dpo/chat (mesma origem, streaming) ──▶ servidor
                                                               │
   1. sessão + dpo.assist (servidor)          ── recusa 403    │
   2. ritmo por pessoa (Upstash)              ── "aguarde"     │
   3. teto do mês da serventia (Postgres)     ── "limite"      │
   4. ocultação (core/dpo/mask)  ◀── daqui em diante só texto ocultado
   5. grava a mensagem do usuário (ocultada)
   6. triagem: modelo leve, saída estruturada
        { inScope: boolean, searchQuery: string }
        └── fora do tema: recusa padrão, grava, conta "refused", FIM
   7. busca na base (core/dpo/knowledge) com searchQuery + pergunta
   8. modelo principal: instruções fixas + resumo da serventia
        + trechos encontrados (com id) + histórico ocultado
   9. resposta em streaming, citações como [[fonte:id]]
  10. ao terminar: valida citações, grava, conta "answered"
```

O passo 4 vem antes de tudo o que grava ou sai do servidor. Nenhum caminho do código tem acesso ao
texto original depois dele. A ocultação é feita no Route Handler, e a função recebe o corpo da
requisição e devolve só a versão ocultada.

### 2. AI SDK sobre a Anthropic, com a chave e o interruptor da plataforma

**Escolha (revista na implementação, depois do merge da base jurídica, PR #332).**

- O pacote `ai` (AI SDK) no servidor, com o provedor `@ai-sdk/anthropic`: `generateText` com
  saída estruturada na triagem e `streamText` na resposta.
- Modelos: `claude-haiku-5-5` na triagem e `claude-sonnet-5-5` na resposta, em
  `src/lib/dpo/models.ts`.
- A mesma `ANTHROPIC_API_KEY` e o mesmo interruptor "Inteligência artificial" da serventia que a
  base jurídica usa (`lib/ai.ts`, `aiBlockedWith`): sem chave ou com a IA desligada pelo
  Tabelião/Registrador, a tela diz por quê e nada é enviado.
- A tela lê a resposta como linhas JSON (`DpoEvent`) num Route Handler da própria origem, sem o
  `useChat`: o protocolo próprio leva o texto ocultado, as fontes validadas e o uso do mês.

**Por quê.**

- Uma chave, um fornecedor e um interruptor para toda a IA da plataforma: a serventia decide
  num lugar só se usa IA.
- O AI SDK dá o modelo falso (`MockLanguageModelV4`) que os testes em processo usam.
- O streaming roda no Node, sem `runtime = "edge"`.

**Alternativas.**

- Vercel AI Gateway com retenção zero: era a proposta inicial. Descartada porque a plataforma
  já tinha adotado a Anthropic direto com chave própria; dois caminhos para a mesma IA seriam
  dois lugares para configurar e auditar.
- Modelo próprio hospedado: descartado pelo custo e pela operação, desproporcionais ao uso.

### 3. Base de normas versionada no repositório e busca em memória

**Escolha.** A base fica em arquivos do repositório (`src/core/dpo/knowledge/`), um por norma.
Cada dispositivo tem:

- um id estável (`lgpd-art-18-vi`, `prov213-art-16-p1`);
- a citação formatada ("LGPD, art. 18, VI");
- o texto;
- a norma de origem.

A data da última atualização fica em `KNOWLEDGE_BASE_UPDATED_AT`.

A busca é lexical, em memória, pura, com tokens em minúsculas e sem acento, um radical simples
do português e pontuação BM25. Ela devolve os 8 a 12 dispositivos mais relevantes.

A base também tem uma fonte própria, **"Orientação"**. São notas curtas, marcadas como
orientação e não como norma, para as sutilezas que já custaram retrabalho:

- os 15 dias valem para o acesso por lei (art. 19, II); para os outros direitos é regra da casa;
- a dispensa do encarregado na Classe 1 (§ 4º do art. 88, do 205/2025, reescrito pelo 214/2026);
- o requerimento pelo Gov.br vale para ato notarial (CNN, art. 286, III), mas não alcança
  registros nem protesto;
- a prorrogação de 90 dias da CGJ-RN (decisão de 02/07/2026).

**Por quê.**

- A base cabe com folga em memória: algumas centenas de dispositivos.
- A busca pura é determinística e testável com `node --test`, sem extensão de banco nem chamada
  de embedding por pergunta.
- Atualizar a base é um PR revisável: a Átrios vê exatamente o que mudou.

**Alternativas.**

- **pgvector com embeddings:** melhor para perguntas com palavras diferentes das da lei.
  Descartado por ora, porque a triagem já reescreve a pergunta em termos de busca
  (`searchQuery`), o que cobre a maior parte dessa distância. É o próximo passo se a revisão das
  conversas mostrar perguntas sem fonte que a base cobria.
- **Full-text do Postgres:** precisa de `unaccent` e de configuração `portuguese`, que o PGlite
  dos testes não garante.
- **Mandar a base inteira em todas as chamadas:** simples, mas o custo por pergunta cresce com a
  base.

### 4. Citação verificada pela plataforma

As instruções exigem que toda regra afirmada traga `[[fonte:<id>]]`. Ao fim da resposta, o
servidor confere cada id contra os dispositivos entregues naquela chamada:

- um id válido vira a fonte clicável, que abre o texto da base;
- um id inexistente ou não entregue é removido do texto e registrado em
  `dpo_messages.invalidCitations`, para a Átrios revisar.

Uma resposta que afirma regra sem nenhuma fonte válida recebe o aviso "Resposta sem fonte na
base: confirme antes de usar". Durante o streaming, os marcadores aparecem como fonte pendente e
são resolvidos ao fim.

### 5. Ocultação de dados pessoais no núcleo

`maskPersonalData(text): { text: string; counts: Record<MaskKind, number> }` é uma função pura em
`src/core/dpo/mask.ts`. A ordem importa: os padrões mais específicos vêm primeiro, para um
número não ser capturado duas vezes.

| Tipo | Regra | Marcador |
|---|---|---|
| E-mail | formato local@domínio | `[E-MAIL]` |
| Matrícula do registro civil | 32 dígitos, com ou sem separadores | `[MATRÍCULA]` |
| CNPJ | 14 dígitos com verificador válido | `[CNPJ]` |
| CPF | 11 dígitos com verificador válido | `[CPF]` |
| CNS | 15 dígitos com regra do cartão | `[CNS]` |
| PIS/NIS | 11 dígitos com verificador do PIS, se não for CPF | `[NIS]` |
| Título de eleitor | 12 dígitos com verificador | `[TÍTULO]` |
| CNH | 11 dígitos junto a "CNH" | `[CNH]` |
| RG | número junto a "RG" ou "identidade" | `[RG]` |
| Telefone | (DDD) + 8 ou 9 dígitos, com ou sem +55 | `[TELEFONE]` |
| CEP | 5+3 dígitos | `[CEP]` |
| Endereço | "Rua/Av./Travessa/…" até o número | `[ENDEREÇO]` |
| Nascimento | data a até 30 caracteres de "nasc" | `[NASCIMENTO]` |

As exceções são cobertas por testes:

- números de lei e provimento (`13.709/2018`, `213/2026`);
- artigos, parágrafos e incisos;
- datas soltas (prazos);
- protocolos da plataforma (`REQ-`, `SOL-`, `OUV-`);
- valores em reais.

O arquivo de teste tem duas listas, uma de frases que **devem** mudar e outra que **não podem**
mudar. Errar para o lado de ocultar é aceitável. Vazar não é.

A mesma função é usada na observação opcional do "Rascunhar resposta". A resposta do modelo não
passa pela ocultação, porque ele nunca recebeu dado real. Os marcadores que ele devolve são os
que nós definimos.

### 6. Marcadores preenchidos só na plataforma

`fillPlaceholders(draft, values)` fica no núcleo e troca `[TITULAR]`, `[PROTOCOLO]`,
`[DATA_DO_PEDIDO]`, `[SERVENTIA]` e `[ENCARREGADO]`. Um marcador sem valor fica como está. O
preenchimento acontece numa Server Action do requerimento LGPD, que:

1. confere `dpo.assist` e o tenant do requerimento;
2. chama o modelo só com `{ right, attributions, note: masked }`;
3. preenche;
4. devolve o texto ao campo.

O rascunho não é salvo como rascunho do requerimento até a pessoa clicar em "Salvar rascunho"
ou "Enviar", que já existem.

### 7. Dados no banco

A migração é aditiva:

- **`dpo_conversations`:**
  - `id`, `tenantSlug`, `userId`;
  - `userRole`, o cargo no momento da conversa, para a Átrios ler sem expor o nome;
  - `title`, a primeira pergunta ocultada, cortada em 80 caracteres;
  - `createdAt`, `lastMessageAt`.
- **`dpo_messages`:**
  - `id`, `conversationId`, `role` (`user` | `assistant` | `refusal`);
  - `content`, sempre ocultado;
  - `maskedCounts` (jsonb), `sources` (ids), `invalidCitations` (ids);
  - `kind` (`chat` | `reply-draft`), `createdAt`.
- **`dpo_monthly_usage`:** `tenantSlug`, `month` (`YYYY-MM` no fuso do escritório),
  `answered`, `refused`, com chave (`tenantSlug`, `month`).
- **`dpo_tenant_settings`:** `tenantSlug`, `monthlyLimit` (nulo significa o padrão de 300).

O rascunho do requerimento grava só a contagem de uso e uma mensagem `reply-draft` com o pedido
abstrato e a resposta com marcadores, **antes** do preenchimento. Assim, a versão preenchida
nunca é gravada no assistente.

O incremento de uso é um `insert … on conflict do update set answered = answered + 1`, feito
**só** quando a resposta termina sem erro. A checagem do teto antes da chamada aceita uma pequena
ultrapassagem em perguntas simultâneas, o que é tolerável. A alternativa de reservar a vaga antes
e devolvê-la em caso de erro foi descartada por complicar o caminho de falha em troca de pouco.

### 8. Permissão e navegação

- `dpo.assist` entra em `OFFICE_PERMISSIONS` e `GRANTABLE_PERMISSIONS`, com
  `DERIVED_FROM["dpo.assist"] = "desk.access"` e o rótulo "Assistente do DPO" em Perfis e
  permissões.
- `learner` não tem `desk.access`, então fica de fora sem regra especial.
- Em `nav.ts`, o grupo "Proteção de dados" vem depois de "Canais do cidadão", com o item "DPO"
  e os filhos "Perguntar" e "Minhas conversas".
- A área da Átrios ganha "Assistente do DPO" ao lado de "Liberação de acesso", só para
  `superadmin`.

### 9. Expurgo na rotina diária existente

A rotina diária que já roda (`/api/agenda/lembretes`, autenticada por `CRON_SECRET` e chamada
também quando o painel abre) passa a chamar `purgeExpiredDpoConversations(now)`. A regra
"última mensagem há mais de 12 meses" fica no núcleo (`src/core/dpo/retention.ts`), e a exclusão
apaga as mensagens em cascata. Não é preciso um cron novo em `vercel.json`.

### 10. Ritmo por pessoa

Um limitador Upstash novo em `src/lib/rate-limit.ts` permite 6 perguntas por minuto por
`userId`, com prefixo `veridia:dpo`. Como os outros, fica desligado sem Upstash. O teto mensal é
contado no Postgres e vale em qualquer ambiente.

## Risks / Trade-offs

- **[Nome próprio passa pela ocultação]** → Aviso fixo, instrução ao modelo de não pedir nem
  repetir nomes e revisão das conversas pela Átrios. O que passa fica gravado, mas só no nosso
  banco e no modelo com retenção zero. Uma lista de prenomes do IBGE pode ser testada depois,
  medindo falsos positivos.
- **[Ocultação esconde coisa demais]** (um número de livro ou de folha confundido com
  documento) → Os verificadores de CPF, CNPJ, PIS e título reduzem esse risco. A pessoa vê o que
  foi ocultado e pode reescrever.
- **[Modelo inventa artigo]** → Citação verificada (decisão 4), aviso quando não há fonte válida
  e `invalidCitations` para revisão.
- **[Triagem recusa pergunta legítima]** → A recusa diz para que o assistente serve e sugere
  reformular. As recusas ficam gravadas, e a Átrios ajusta as instruções da triagem com casos
  reais.
- **[Prompt injection]** → A única entrada não curada é a mensagem da pessoa. A triagem trata
  tentativa de mudar instruções como fora do tema. O assistente não tem ferramentas que gravem,
  enviem ou leiam dados de pessoas. O pior caso é uma resposta fora do tema, não um vazamento.
- **[Base desatualizada]** → A data fica visível na tela. Toda norma nova do CNJ, da ANPD ou da
  CGJ-RN sobre o tema entra por PR. A "Orientação" registra a data em que foi escrita.
- **[Custo acima do previsto]** → Triagem barata, recusas sem modelo principal, teto por
  serventia e uso por serventia visível para a Átrios. O histórico enviado ao modelo é cortado
  nas últimas 10 trocas.
- **[Provedor fora do ar]** → Erro com "Tentar de novo", sem consumir o teto. O resto do painel
  não depende do assistente.
- **[Conversas visíveis à Átrios]** → Aviso fixo na tela, e o conteúdo gravado já está
  ocultado. Os documentos legais da plataforma citam a supervisão.

## Migration Plan

1. Migração aditiva com as quatro tabelas, aplicada pelo `db:migrate` do build de produção. No
   Homolog, aplicar à mão pelo pooler, porque o Preview não migra.
2. Usar a `ANTHROPIC_API_KEY` que a base jurídica já exige em Produção e Preview. Cada
   serventia só usa o assistente depois que o Tabelião/Registrador liga a IA em Configurações.
3. Publicar com a base de normas inicial. O item aparece para todos os cargos com `desk.access`.
4. Avisar as serventias: o que o assistente faz, o aviso sobre dados e a supervisão da Átrios.
5. **Reversão:** retirar o item da navegação e responder "indisponível" no Route Handler. As
   tabelas podem ficar (expand/contract) até uma change de remoção.

## Open Questions

- **Retenção no provedor:** confirmar a política de retenção da conta da Anthropic (o texto já
  chega ocultado, mas a retenção zero é a segunda trava).
- **Modelos:** definir a dupla final (triagem e resposta) depois de um teste com 30 a 50
  perguntas reais de encarregados, comparando qualidade da citação e custo.
- **Texto legal:** redação do trecho da política de privacidade e da linha do inventário de
  tratamento da Átrios.
- **Escopo da base inicial:** quais resoluções da ANPD entram na primeira versão (agentes de
  pequeno porte, incidentes, encarregado, dosimetria, transferência internacional) e quais
  trechos do Código Nacional de Normas e do Provimento CGJ-RN 156/2016.
