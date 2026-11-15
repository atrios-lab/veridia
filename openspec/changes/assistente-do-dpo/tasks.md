## 1. Núcleo: ocultação e marcadores

- [ ] 1.1 Criar `src/core/dpo/mask.ts` com `maskPersonalData` e os validadores de CPF, CNPJ,
      PIS/NIS, CNS e título de eleitor, na ordem da tabela do design (decisão 5)
- [ ] 1.2 Escrever `mask.test.ts` com duas listas: frases que devem mudar (cada tipo, com e sem
      pontuação) e frases que não podem mudar (leis, provimentos, artigos, prazos, protocolos
      `REQ-`/`SOL-`/`OUV-`, valores em reais, números com verificador inválido)
- [ ] 1.3 Criar `fillPlaceholders` com os cinco marcadores; um marcador sem valor fica no texto.
      Incluir testes

## 2. Núcleo: base de normas e busca

- [ ] 2.1 Definir o formato de um dispositivo (id, citação, texto, norma) e
      `KNOWLEDGE_BASE_UPDATED_AT` em `src/core/dpo/knowledge/`
- [ ] 2.2 Montar a base inicial: LGPD; Provimento CN 213/2026 consolidado com o 214 e o 243;
      trechos do Código Nacional de Normas; resoluções da ANPD escolhidas (pergunta em aberto do
      design); decisão da CGJ-RN de 02/07/2026; trechos do Provimento CGJ-RN 156/2016. Conferir
      cada texto com a fonte oficial
- [ ] 2.3 Escrever a "Orientação da Átrios" (decisão 3): 15 dias só para acesso, dispensa do
      encarregado na Classe 1, art. 286, III do CNN e a prorrogação da CGJ-RN, cada uma com data
- [ ] 2.4 Implementar a busca BM25 em memória (normalização sem acento, radical simples do
      português) com testes: "exclusão de registro de nascimento" encontra os dispositivos de
      eliminação e de guarda obrigatória; "prazo da Etapa 1" encontra o art. 20
- [ ] 2.5 Teste de integridade da base: ids únicos e estáveis, citação e texto não vazios

## 3. Núcleo: contexto, citação, teto e guarda

- [ ] 3.1 `buildOfficeContext` a partir da classificação, dos prazos, das pendências da
      Adequação, das contagens de requerimentos LGPD, das atribuições e de "há encarregado".
      Testar que o resultado não contém nome, e-mail nem documento, inclusive com encarregado
      cadastrado
- [ ] 3.2 `resolveCitations(text, deliveredIds)`: separa as citações válidas, remove as
      inválidas e diz se a resposta ficou sem fonte. Incluir testes
- [ ] 3.3 `usageMonth(now)` no fuso America/Fortaleza e `isOverQuota(usage, limit)` com o padrão
      300. Testar a virada de 30/11 às 22h (horário de Fortaleza)
- [ ] 3.4 `isConversationExpired(lastMessageAt, now)` com 12 meses. Incluir testes
- [ ] 3.5 Escrever as instruções fixas da triagem e da resposta, além da recusa padrão e dos
      avisos de tela, em configuração (texto em português, fora do código)

## 4. Banco

- [ ] 4.1 Schema Drizzle de `dpo_conversations`, `dpo_messages`, `dpo_monthly_usage` e
      `dpo_tenant_settings` (decisão 7) e migração aditiva gerada com `db:generate`
- [ ] 4.2 Funções `...With(db, …)` em `src/lib/dpo/`: criar e retomar conversa, gravar mensagem,
      incrementar uso (`answered` e `refused`), ler o teto, listar as conversas da pessoa,
      listar serventias e conversas para a Átrios e expurgar as vencidas
- [ ] 4.3 Testes contra PGlite: isolamento por pessoa e por serventia, incremento concorrente
      de uso e expurgo apagando as mensagens

## 5. Permissão e navegação

- [ ] 5.1 Adicionar `dpo.assist` a `OFFICE_PERMISSIONS` e `GRANTABLE_PERMISSIONS`, com
      `DERIVED_FROM` de `desk.access` e o rótulo em Perfis e permissões. Testar que `staff` tem,
      que `learner` não tem e que pode ser retirada
- [ ] 5.2 Adicionar o grupo "Proteção de dados" e o item "DPO" ("Perguntar", "Minhas conversas")
      em `nav.ts` e atualizar `nav.test.ts`
- [ ] 5.3 Adicionar "Assistente do DPO" na área da Átrios, só para `superadmin`

## 6. Integração com o modelo

- [ ] 6.1 Adicionar `ai` e `@ai-sdk/react` e configurar os ids dos modelos (triagem e resposta)
      em um só lugar. Detectar quando o Gateway não está configurado
- [ ] 6.2 Implementar `answerDpoQuestionWith(db, deps, input)` em `src/lib/dpo/`, seguindo o
      fluxo do design (decisão 1). O modelo vem por injeção (`deps`), para testar com um modelo
      falso do AI SDK
- [ ] 6.3 Testes em processo com modelo falso:
      - fora do tema não chama a resposta nem conta `answered`;
      - o texto enviado ao modelo já está ocultado;
      - o que foi gravado está ocultado;
      - erro do provedor não conta uso;
      - teto atingido não chama o modelo;
      - citação inventada é removida
- [ ] 6.4 Route Handler `POST /api/dpo/chat` com streaming, apenas como transporte: sessão,
      `dpo.assist`, ritmo Upstash (`veridia:dpo`, 6 por minuto por pessoa) e chamada à função
      da 6.2. Não escrever o corpo da requisição em log

## 7. Telas do painel

- [ ] 7.1 `/admin/dpo`: conversa com `useChat`, contendo:
      - aviso fixo de dados;
      - aviso de supervisão da Átrios;
      - lembrete de que não é parecer;
      - uso do mês e data da base;
      - fontes clicáveis;
      - "Copiar" nos rascunhos;
      - "Ocultamos …" na mensagem enviada;
      - estados de limite, ritmo, erro com "Tentar de novo" e "indisponível neste ambiente"
- [ ] 7.2 `/admin/dpo/conversas`: lista das conversas da pessoa e retomada. Uma conversa de
      outra pessoa é recusada no servidor
- [ ] 7.3 `/admin/atrios/assistente-dpo`: serventias com uso, teto, quantidade de conversas e
      última pergunta; leitura das conversas; ajuste do teto com auditoria do valor anterior e
      do novo

## 8. Rascunho no requerimento LGPD

- [ ] 8.1 `draftDataRightsReplyWith(db, deps, …)`:
      - confere a permissão e o tenant;
      - envia só o direito, as atribuições e a observação ocultada;
      - grava `reply-draft` com marcadores;
      - conta uso;
      - preenche os marcadores com os dados do requerimento.
      Testar que nome, e-mail, texto do titular e protocolo não chegam ao modelo
- [ ] 8.2 Botão "Rascunhar resposta" em `reply-section.tsx`, com observação opcional, confirmação
      para substituir texto existente e o botão oculto sem `dpo.assist`

## 9. Expurgo, ambiente e documentos

- [ ] 9.1 Chamar o expurgo de conversas na rotina diária `/api/agenda/lembretes`
- [ ] 9.2 Configurar o AI Gateway na Vercel (OIDC em Produção e Preview) e confirmar a retenção
      zero para os modelos escolhidos
- [ ] 9.3 Aplicar a migração no Homolog pelo pooler e testar no Preview com o host de uma
      serventia
- [ ] 9.4 Rodar 30 a 50 perguntas reais de encarregado e conferir a triagem, a citação e o
      custo. Fechar a escolha dos modelos
- [ ] 9.5 Atualizar a política de privacidade da plataforma e o inventário de tratamento da
      Átrios. Preparar o aviso às serventias
