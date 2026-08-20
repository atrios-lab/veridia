# data-rights-channel — delta

## MODIFIED Requirements

### Requirement: Resposta do Encarregado protegida por chave

O **texto** da resposta do Encarregado SHALL aparecer somente na consulta por protocolo e chave,
nunca por outro canal, e a consulta SHALL exibir o autor, a data da resposta, o texto e o
andamento com o dia do prazo em que foi respondida.

Registrada a resposta, o site SHALL avisar o titular no e-mail que ele informou no requerimento.
O aviso SHALL dizer apenas que há resposta, com o número do protocolo e o atalho para a consulta;
o texto da resposta e qualquer dado pessoal do requerimento MUST NOT viajar no e-mail.

#### Scenario: Resposta lida na consulta

- **WHEN** o titular consulta com protocolo e chave e há resposta registrada
- **THEN** o texto da resposta, o nome do Encarregado, a data e o andamento aparecem
- **AND** a página afirma que a resposta só aparece para quem tem protocolo e chave

#### Scenario: Titular avisado de que foi respondido

- **WHEN** o Encarregado registra a resposta de um requerimento
- **THEN** o titular recebe no e-mail do requerimento um aviso com o protocolo e o atalho para a
  consulta, sem o texto da resposta

#### Scenario: Falha no envio não desfaz a resposta

- **WHEN** o provedor de e-mail recusa ou não responde no momento do envio
- **THEN** a resposta continua gravada e visível na consulta, e a falha fica apenas no log da
  aplicação
