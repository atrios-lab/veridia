## Context

A Átrios conduz a adequação ao Provimento 243 de várias serventias ao mesmo tempo. O gerador de
documentos (fora do painel, no Cowork) lê um JSON por serventia com chaves no vocabulário dele
(`tit_cpf`, `rt_qualificacao`, `sem_marca`). O que faltava era o lugar onde a serventia responde,
aos poucos, e de onde a Átrios tira o JSON pronto.

O painel já tem tudo de que o módulo precisa: sessão por serventia, perfis (`admin`, `staff`,
`superadmin`), tokens e botões, armazenamento de anexos, e-mail transacional, auditoria. O módulo
não cria linguagem visual nem infraestrutura nova.

Base legal conferida em 06/09/2026 no texto compilado do CNJ e no Portal do RI: art. 16 (classes
por receita bruta semestral: Classe 1 até R$ 300.000, Classe 2 até R$ 1.500.000, Classe 3 acima;
subclasses A a C e D a F em três faixas iguais, G a J por múltiplos de 3, 6 e 12 do piso da
Classe 3), art. 20 (300, 240 e 180 dias para a Etapa 1; 36, 30 e 24 meses para a conclusão) e
art. 2º do Provimento 243 (vigência 30 dias após a publicação no DJe de 23/07/2026, portanto
22/08/2026). A data de vigência é uma constante a confirmar com a Átrios antes de arquivar.

## Goals / Non-Goals

**Goals:**
- A titular responde pelo celular, sai, volta, e a resposta está lá. Sem botão Salvar.
- Uma tela por seção; só as perguntas que fazem sentido para as respostas anteriores.
- O que vira pendência nos documentos avisa na hora, sem bloquear.
- O perfil Átrios baixa o JSON do gerador sem editar nada à mão.
- Nascer preparado para as etapas seguintes (PDFs, protocolo, renovação) sem construí-las.

**Non-Goals:** ver a proposta.

## Decisions

### 1. As 17 seções são dados, não dezessete telas

`src/core/compliance/sections.ts` declara cada seção com seus campos: tipo, obrigatoriedade, ajuda,
opções, "não sei", condição de exibição (`showWhen`), valor padrão derivado (`defaultValue`) e, nas
listas, os campos de cada item. Um único componente (`section-form.tsx`) desenha qualquer seção.

- **Por quê**: o autosave, o "?", o "não sei", o aviso inline e a regra de status são um só código.
  Dezessete formulários à mão seriam dezessete lugares para esses comportamentos divergirem.
- **Condições são funções puras das respostas**, então rodam no servidor (status, revisão, export)
  e no cliente (esconder e mostrar sem ida ao servidor) com o mesmo resultado. Por isso o componente
  cliente importa `SECTIONS` em vez de recebê-las por prop: função não atravessa a fronteira
  servidor-cliente.
- Identificadores (`name`, `value` das opções) em inglês e estáveis, porque são as chaves gravadas
  e lidas pelo export. Todo texto visível em português, no próprio arquivo.
- Simplificações em relação ao brief, deliberadas: "quantas pessoas" e "quantos computadores" não
  são campos separados; são o tamanho das listas de pessoas e de equipamentos, que é a única
  contagem que não pode contradizer a lista.

### 2. Uma linha por serventia, respostas em JSONB, data por seção

`compliance_intakes`: `answers` (seção → campo → valor), `section_updated_at` (seção → instante da
última gravação), `attachments` (lista), `submitted_at`, `submitted_version`, `submitted_by`.

- **Gravação por campo sem ler antes**: `jsonb_set(answers, '{secao}', coalesce(answers->'secao',
  '{}') || patch)`. Dois campos deixados em sequência rápida gravam cada um a sua chave; nenhum
  sobrescreve o outro. O id da seção entra cru no caminho JSONB e por isso é validado contra
  `SECTIONS` antes.
- **Status calculado, nunca gravado**: "não iniciada" é seção sem data; "concluída" é seção com
  data e sem campo obrigatório visível vazio; o resto é "em andamento". Seção pré-preenchida fica
  "não iniciada" até a serventia abrir e confirmar (o botão "Próxima" grava a data): confirmar é o
  que o brief pede, e a visita é a confirmação.
- **"Alterada após o envio"** é `section_updated_at[secao] > submitted_at`. Sem coluna extra.
- A versão do envio é o gancho das etapas futuras: um dossiê ou um protocolo do Justiça Aberta
  poderá apontar para "versão 2 das respostas" sem a tabela mudar de forma.

### 3. Respostas efetivas: digitado, sobre pré-preenchido, sobre derivado

`effectiveAnswers(stored, prefill)`: o que a serventia gravou vence o que o painel sabia
(`prefillFor(tenant)`: nome, CNS, endereço, telefone, e-mail, atribuições, titular, encarregado),
que vence o `defaultValue` (nacionalidade pelo gênero, nobreak pela Seção 7, fornecedores pela
Seção 6, qualificação do RT pelo cargo). As seções são percorridas em ordem, então um padrão pode
ler outro preenchido logo antes.

### 4. Regras de derivação são detecção, não aplicação

`detectPendencies(answers)` devolve o que os documentos vão carregar, com gravidade e o campo que
originou. A tela da seção mostra o aviso embaixo do campo, a revisão lista tudo, o perfil Átrios vê
o razão. Quem aplica no documento é o gerador; o JSON leva a lista em `pendencias` para a Átrios
conferir. Os "não sei" saem à parte (`unknownAnswers`), porque são o que a Átrios confirma por
WhatsApp.

### 5. Exportar é do perfil Átrios, e a checagem é na rota

O botão só aparece para `role === "superadmin"`, e `/admin/adequacao/exportar` repete a checagem:
esconder o botão é cortesia, não controle. O JSON é montado por `toGeneratorJson`, função pura
testada contra as chaves do gerador. Sem o `bom-jesus.json` de exemplo no repositório, o mapeamento
segue a lista de chaves do brief; a primeira rodada real com o gerador é quem confirma o formato.

### 6. Envio carimba, não trava

`submitIntake` grava data, autor e versão (+1) e audita. Os dois e-mails saem depois, em
`Promise.allSettled`: a falha do provedor de e-mail vira log, nunca desfaz um envio que a serventia
já viu confirmado. O destino da Átrios é `COMPLIANCE_NOTIFY_EMAIL`, com `contato@atrioss.com` como
padrão.

### 7. Anexos pelo mesmo caminho dos demais

`storeAttachments` (tipo, tamanho, nome gerado por tenant) e `deleteStoredFile`, como em
Publicações. Os metadados ficam na própria linha do intake, em `attachments`, e a rota
`/admin/adequacao/anexo?id=` serve o arquivo com sessão, no molde de `/admin/documento`.

## Risks / Trade-offs

- **Tabela do art. 16 atualizada anualmente** pela Corregedoria Nacional: são duas constantes em
  `classification.ts`. Mudança de código, não de configuração, porque muda uma vez por ano para
  todas as serventias ao mesmo tempo.
- **Formato exato do JSON**: sem o exemplo no repositório, chaves extras foram incluídas com nomes
  no mesmo vocabulário. Se o gerador rejeitar chaves desconhecidas, a lista em `export.ts` é o único
  lugar a ajustar.
- **Lista salva inteira**: uma lista longa (inventário de 20 itens) grava o array todo a cada campo
  deixado. Simples e correto; se pesar, o item vira linha própria.
- **Rascunho por campo, não por sessão**: um valor inválido (CPF errado) não é gravado e a tela
  avisa por toast; a titular precisa corrigir antes de sair da tela, ou perde só aquele campo.
