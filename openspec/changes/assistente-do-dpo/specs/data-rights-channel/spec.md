## ADDED Requirements

### Requirement: Rascunho de resposta pelo assistente do DPO sem enviar dados do titular

No detalhe do requerimento LGPD, quem tem `dpo.assist` SHALL ver a ação "Rascunhar resposta"
junto ao campo "Resposta ao titular". Ao modelo SHALL ir só:

- o direito pedido (`access`, `rectification`, `deletion` ou `other`);
- as atribuições da serventia;
- uma observação opcional da equipe, que passa pela mesma ocultação de dados pessoais do
  assistente.

O texto escrito pelo titular, os anexos, o nome, o documento, o e-mail e o protocolo NÃO SHALL
ser enviados. O modelo SHALL devolver o rascunho com marcadores, e o servidor da plataforma SHALL
trocá-los pelos dados do requerimento:

| Marcador | Dado do requerimento |
|---|---|
| `[TITULAR]` | nome do titular |
| `[PROTOCOLO]` | protocolo |
| `[DATA_DO_PEDIDO]` | data do pedido |
| `[SERVENTIA]` | nome oficial da serventia |
| `[ENCARREGADO]` | nome do encarregado cadastrado |

O resultado SHALL substituir o conteúdo do campo de resposta só depois de confirmação, se o
campo já tiver texto. NÃO SHALL ser salvo nem enviado ao titular sem a ação de quem atende. Um
marcador sem dado correspondente SHALL ficar visível no texto, para a pessoa completar. O
rascunho SHALL consumir uma pergunta do teto mensal da serventia.

#### Scenario: Rascunho preenchido na plataforma

- **WHEN** a equipe pede "Rascunhar resposta" em um pedido de exclusão
- **THEN** o modelo recebe só "exclusão" e as atribuições, e o campo de resposta recebe o texto
  já com o nome do titular e o protocolo, preenchidos pela plataforma

#### Scenario: Texto existente não é perdido sem aviso

- **WHEN** o campo de resposta já tem texto e a equipe pede o rascunho
- **THEN** a plataforma pergunta se deve substituir o texto antes de trocá-lo

#### Scenario: Encarregado não cadastrado

- **WHEN** a serventia não cadastrou o encarregado e o rascunho contém `[ENCARREGADO]`
- **THEN** o marcador continua no texto para a equipe completar

#### Scenario: Sem permissão, sem botão

- **WHEN** quem atende o requerimento não tem `dpo.assist`
- **THEN** a ação não aparece, e a chamada direta é recusada no servidor
