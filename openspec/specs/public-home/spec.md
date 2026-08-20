# public-home

## Purpose

TBD

## Requirements

### Requirement: Ação na primeira dobra
A home DEVE (SHALL) apresentar, dentro da hero (imagem oficial da serventia com overlay da cor
primária), o campo único de consulta de protocolo — visível na primeira dobra em viewport
mobile 390px — seguido dos cartões de ação (Solicitar serviço, Agendar atendimento, Verificar
selo digital). Conteúdo institucional (atribuições, quem somos) vem depois das ações.

#### Scenario: Consulta direto da home
- **WHEN** o cidadão digita um protocolo no campo da hero e envia
- **THEN** ele navega para a rota de consulta com o número preenchido, sem procurar em menus

#### Scenario: Campo único para qualquer tipo de protocolo
- **WHEN** a hero renderiza
- **THEN** o texto de apoio comunica que o mesmo campo serve para REQ, AGD, SOL e ouvidoria

#### Scenario: Hero sem imagem configurada
- **WHEN** o asset de hero do tenant não existe
- **THEN** a hero degrada para o gradiente sobre a cor primária, sem quebrar o layout

### Requirement: Blocos da home refletem a configuração do tenant
Os blocos da home DEVEM (SHALL) derivar da configuração do tenant: as atribuições exibidas
("O cartório atende"), os cartões de ação e os itens de "Cidadão e transparência" seguem
as atribuições e seções habilitadas;
nomes, subtítulo, horário e texto legal DEVEM (SHALL) vir do tenant, nunca hardcoded.

#### Scenario: Atribuições dinâmicas
- **WHEN** um tenant possui apenas um subconjunto das seis atribuições
- **THEN** apenas essas aparecem nos chips, e a grade de serviços se reacomoda (auto-fit) sem buracos

#### Scenario: Horário no cartão de agendamento
- **WHEN** o cartão "Agendar atendimento" renderiza
- **THEN** o subtítulo mostra o `openingHours` do tenant

### Requirement: Stub de consulta de protocolo
Enquanto a consulta (Entrega 2) não existe, a rota `/protocolo` DEVE (SHALL) existir como stub: exibe
o protocolo recebido, informa que a consulta on-line está em construção e mostra os canais de
contato do tenant. Nenhum link público DEVE (SHALL) apontar para rota inexistente.

#### Scenario: Stub responde
- **WHEN** o cidadão envia o campo da hero com `REQ.2026.000148`
- **THEN** `/protocolo` responde 200 exibindo o número e os contatos da serventia
