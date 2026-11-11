## ADDED Requirements

### Requirement: Nome do documento em todo envio

O painel e o site SHALL oferecer, em todo envio de arquivo, um campo opcional de nome com um botão de
sugestões, e SHALL guardar o arquivo com o nome escolhido. A entrega ao cidadão sem nome SHALL usar um nome
padrão numerado com o protocolo, e todo documento entregue SHALL poder ser renomeado.

#### Scenario: Vários arquivos com um nome

- **WHEN** alguém envia dois arquivos com o nome "RG"
- **THEN** eles ficam como "RG" e "RG (2)"

#### Scenario: Entrega sem nome

- **WHEN** o funcionário entrega o segundo documento do pedido sem informar nome
- **THEN** o documento aparece como "Documento final 2 · " seguido do protocolo
