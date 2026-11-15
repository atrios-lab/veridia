## ADDED Requirements

### Requirement: Assistente do DPO no painel para quem tem a permissão

O painel SHALL oferecer o item "DPO", no grupo "Proteção de dados" da barra lateral, com as
telas "Perguntar" (`/admin/dpo`) e "Minhas conversas" (`/admin/dpo/conversas`). O acesso SHALL
depender da permissão `dpo.assist`, verificada no servidor em cada tela e em cada chamada ao
assistente, e não só ao montar o menu. A permissão SHALL derivar de `desk.access`: todo cargo do
painel que tem a mesa de trabalho a recebe por padrão, e o Tabelião/Registrador SHALL poder
retirá-la em Perfis e permissões. O cargo `learner` NÃO SHALL ter acesso.

#### Scenario: Escrevente vê o item desde o primeiro dia

- **WHEN** uma pessoa com cargo `staff`, sem ajuste nas permissões, abre o painel
- **THEN** a barra lateral mostra "DPO" no grupo "Proteção de dados", e "Perguntar" abre a
  conversa

#### Scenario: Permissão retirada bloqueia a rota

- **WHEN** o Tabelião/Registrador retira `dpo.assist` de um cargo e uma pessoa desse cargo abre
  `/admin/dpo` pelo endereço
- **THEN** a rota recusa o acesso, e uma chamada direta ao Route Handler do assistente também é
  recusada

#### Scenario: Aluno do curso não vê

- **WHEN** uma conta `learner` abre o painel
- **THEN** o item "DPO" não aparece e `/admin/dpo` recusa o acesso

### Requirement: Assistente restrito à proteção de dados

Toda mensagem SHALL passar por uma triagem antes do modelo principal. A triagem SHALL aceitar
temas de proteção de dados no contexto da serventia: LGPD, Provimento CN 213/2026 e suas
alterações, papel e atribuições do encarregado, direitos do titular, respostas ao titular e à
ANPD, incidentes de segurança, adequação e fiscalização. Também SHALL aceitar o uso do próprio
assistente. Uma mensagem fora do tema SHALL receber uma recusa padrão, vinda de configuração,
que diga para que o assistente serve, e o modelo principal NÃO SHALL ser chamado. Uma tentativa
de mudar as instruções do assistente ("ignore as instruções anteriores") SHALL ser tratada como
fora do tema.

#### Scenario: Pergunta sobre o tema é respondida

- **WHEN** a pessoa pergunta "o titular pode pedir a exclusão de um registro de nascimento?"
- **THEN** o assistente responde e cita a fonte

#### Scenario: Pergunta fora do tema é recusada sem custo

- **WHEN** a pessoa pede "escreva uma receita de bolo" ou "qual o emolumento de uma escritura?"
- **THEN** o assistente responde com a recusa padrão, o modelo principal não é chamado e a
  pergunta não consome o teto mensal

#### Scenario: Tentativa de sair do papel é recusada

- **WHEN** a mensagem pede que o assistente ignore as instruções e responda sobre outro assunto
- **THEN** a mensagem recebe a recusa padrão

### Requirement: Respostas apoiadas na base de normas, com citação

O assistente SHALL responder com base em uma base de normas selecionada, versionada pela Átrios
e dividida por dispositivo (artigo, parágrafo, inciso). Ela reúne a LGPD, o Provimento CN 213/2026
consolidado, os trechos aplicáveis do Código Nacional de Normas, as resoluções da ANPD e os atos
da CGJ-RN sobre o tema. Toda resposta que afirme uma regra SHALL citar o dispositivo da base em
que se apoia. A tela SHALL mostrar as fontes da resposta, e cada fonte SHALL abrir o texto
daquele dispositivo. Quando a base não cobrir a pergunta, o assistente SHALL dizer que não
encontrou fundamento na base e NÃO SHALL inventar artigo, prazo ou número. A tela SHALL mostrar
a data da última atualização da base.

#### Scenario: Fonte citada abre o texto

- **WHEN** uma resposta cita "LGPD, art. 18, VI"
- **THEN** a resposta mostra a fonte, e abri-la exibe o texto daquele inciso como está na base

#### Scenario: Pergunta sem fundamento na base

- **WHEN** a pessoa pergunta algo do tema que nenhum dispositivo da base cobre
- **THEN** o assistente diz que não encontrou fundamento na base e sugere consultar o suporte da
  Átrios, sem citar dispositivo inexistente

#### Scenario: Data da base visível

- **WHEN** a pessoa abre `/admin/dpo`
- **THEN** a tela mostra "Base de normas atualizada em <data>"

### Requirement: Contexto da serventia sem dado pessoal

O assistente SHALL receber da plataforma, a cada conversa, um resumo da serventia formado só por
dados que não identificam pessoas:

- classe e subclasse do Provimento 213;
- prazos da Etapa 1 e da conclusão;
- quantidade de pendências da Adequação ao Provimento;
- quantidade de requerimentos LGPD abertos e quantos vencem nos próximos 5 dias;
- atribuições da serventia;
- se há encarregado cadastrado.

O resumo NÃO SHALL incluir nome, documento ou contato de pessoa alguma, nem mesmo do
encarregado. Quando a serventia ainda não preencheu a Adequação, o resumo SHALL dizer que a
classe é desconhecida, e o assistente NÃO SHALL presumir uma.

#### Scenario: Prazo da própria serventia

- **WHEN** a serventia é Classe 2 e a pessoa pergunta "quando vence minha Etapa 1?"
- **THEN** o assistente responde com a data calculada pela plataforma para essa serventia

#### Scenario: Adequação não preenchida

- **WHEN** a serventia não informou o faturamento na Adequação e a pessoa pergunta a classe
- **THEN** o assistente diz que a classe ainda não foi informada e indica a tela Adequação ao
  Provimento

### Requirement: Dados pessoais ocultados antes de sair do servidor

A tela SHALL exibir, fixo junto ao campo de mensagem, um aviso para não escrever nomes,
documentos ou contatos e para descrever a situação. No servidor, antes de chamar qualquer
modelo e antes de gravar, toda mensagem SHALL passar pela ocultação, que troca por marcadores:

- CPF e CNPJ com dígito verificador válido;
- RG, CNH, título de eleitor, PIS/NIS e CNS;
- matrícula do registro civil;
- e-mail, telefone, CEP e endereço;
- data junto a termo de nascimento.

O texto original NÃO SHALL ser gravado no banco nem escrito em log. A ocultação NÃO SHALL alterar
citações legais, números de lei ou provimento, datas de prazo e números de protocolo da
plataforma. Depois do envio, a tela SHALL mostrar a mensagem como foi gravada e dizer quantos
itens de cada tipo foram ocultados.

#### Scenario: CPF ocultado e avisado

- **WHEN** a pessoa envia "o titular 123.456.789-09 pediu a exclusão, contato maria@exemplo.com"
- **THEN** o modelo e o banco recebem "o titular [CPF] pediu a exclusão, contato [E-MAIL]", e a
  tela mostra "Ocultamos 1 CPF e 1 e-mail desta mensagem"

#### Scenario: Citação legal preservada

- **WHEN** a mensagem contém "Lei 13.709/2018, art. 18, § 4º", "Provimento 213/2026" e
  "prazo até 23/09/2026"
- **THEN** o texto chega ao modelo sem alteração

#### Scenario: Número de 11 dígitos que não é CPF

- **WHEN** a mensagem contém uma sequência de 11 dígitos com dígito verificador inválido
- **THEN** a sequência não é tratada como CPF

### Requirement: Rascunho de documentos com marcadores

Quando a pessoa pedir um documento, o assistente SHALL redigi-lo usando marcadores no lugar de
qualquer dado pessoal ou da serventia que ele não conheça: `[TITULAR]`, `[PROTOCOLO]`,
`[DATA_DO_PEDIDO]`, `[SERVENTIA]`, `[ENCARREGADO]`. São documentos como resposta ao titular,
justificativa de negativa, comunicação de incidente à ANPD, aviso aos titulares, política
interna e termo de nomeação do encarregado. O rascunho SHALL ter a ação "Copiar". A tela SHALL
lembrar que o rascunho precisa da revisão e da decisão do encarregado.

#### Scenario: Justificativa de negativa

- **WHEN** a pessoa pede "uma justificativa para negar a exclusão de dados de um registro de
  casamento"
- **THEN** o assistente entrega um texto com o fundamento citado e com `[TITULAR]` e
  `[PROTOCOLO]` no lugar dos dados, pronto para copiar

### Requirement: Limite de uso por serventia e por pessoa

Cada serventia SHALL ter um teto mensal de perguntas respondidas, 300 por padrão, contadas por
mês civil no fuso America/Fortaleza e guardadas no banco. Recusas por estar fora do tema NÃO
SHALL consumir o teto. Os rascunhos pedidos no requerimento LGPD SHALL consumir. Atingido o
teto, a tela SHALL informar até quando o assistente fica indisponível para a serventia, e o
modelo NÃO SHALL ser chamado. Cada pessoa SHALL ter também um limite de ritmo por minuto. Ao
excedê-lo, a pessoa SHALL ver uma mensagem pedindo para aguardar. A tela SHALL mostrar quanto do
teto do mês a serventia já usou.

#### Scenario: Teto atingido

- **WHEN** a serventia já teve 300 perguntas respondidas no mês e alguém envia outra
- **THEN** a tela informa que o limite do mês foi atingido e que o assistente volta em 1º do mês
  seguinte, sem chamar o modelo

#### Scenario: Virada do mês no fuso da serventia

- **WHEN** uma pergunta é feita às 22h de 30/11 no horário de Fortaleza (01h de 01/12 em UTC)
- **THEN** ela conta no uso de novembro

### Requirement: Histórico próprio e guarda de 12 meses

As conversas SHALL ser gravadas por serventia e por pessoa, já com os dados ocultados. Em
"Minhas conversas", cada pessoa SHALL ver só as próprias conversas e poder retomá-las. Nem o
Tabelião/Registrador SHALL ver as conversas de outra pessoa da equipe. A tela do assistente SHALL
avisar, de forma fixa, que as conversas ficam visíveis à equipe da Átrios para suporte e
melhoria. Uma conversa SHALL ser apagada definitivamente 12 meses depois da última mensagem.

#### Scenario: Conversa de colega não aparece

- **WHEN** duas pessoas da mesma serventia usam o assistente e uma abre "Minhas conversas"
- **THEN** a lista mostra só as conversas dela, e abrir pelo endereço uma conversa da outra é
  recusado

#### Scenario: Expurgo após 12 meses

- **WHEN** a última mensagem de uma conversa tem mais de 12 meses
- **THEN** a rotina diária apaga a conversa e as mensagens dela

### Requirement: Assistente indisponível sem configuração

Quando o provedor de IA não estiver configurado no ambiente, `/admin/dpo` SHALL informar que o
assistente está indisponível neste ambiente e NÃO SHALL quebrar o painel. Uma falha do provedor
durante a resposta SHALL aparecer como mensagem de erro com a opção de tentar de novo, e a
pergunta que falhou NÃO SHALL consumir o teto.

#### Scenario: Desenvolvimento local sem chave

- **WHEN** o painel roda sem a variável do AI Gateway e a pessoa abre `/admin/dpo`
- **THEN** a tela mostra que o assistente está indisponível neste ambiente

#### Scenario: Provedor falha no meio da resposta

- **WHEN** o provedor devolve erro durante a resposta
- **THEN** a tela mostra o erro com "Tentar de novo" e o uso do mês não aumenta
