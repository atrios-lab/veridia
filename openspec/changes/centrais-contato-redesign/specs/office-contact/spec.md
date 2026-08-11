# office-contact

## ADDED Requirements

### Requirement: Página de contato com canais acionáveis

A página `/contato`, sob `requireSection("centrais-contato")`, SHALL apresentar os canais da serventia como ações, a partir de `tenant.contacts`: chamar no WhatsApp (`wa.me`), ligar (`tel:`, no mobile) e copiar o e-mail (clipboard com feedback visual). Nenhum canal SHALL ser duplicado em cartões distintos com o mesmo número.

#### Scenario: Chamar no WhatsApp

- **WHEN** o cidadão toca "Chamar no WhatsApp"
- **THEN** abre `https://wa.me/55` + dígitos do WhatsApp configurado do tenant

#### Scenario: Copiar e-mail

- **WHEN** o cidadão clica "Copiar" no cartão de e-mail
- **THEN** o e-mail institucional vai para a área de transferência e o botão confirma ("Copiado!") por alguns segundos

### Requirement: Selo aberto/fechado calculado pelo expediente

A página SHALL exibir um selo de estado calculado pelo expediente do tenant (dia útil + `tenant.scheduling`, mesma janela do chat e do agendamento): aberto ("Aberto agora · fecha às {fim}h") ou fechado ("Fechado agora · abre {dia} às {início}h"). O cálculo SHALL reusar a regra de núcleo existente (`isWithinChatHours` / `nextChatOpening`), nunca uma cópia dela.

#### Scenario: Dentro do expediente

- **WHEN** o cidadão abre `/contato` numa terça às 10h (horário do cartório)
- **THEN** vê o selo verde "Aberto agora · fecha às 14h"

#### Scenario: Fora do expediente

- **WHEN** o cidadão abre `/contato` num sábado
- **THEN** vê o selo neutro "Fechado agora" com o próximo dia útil e a hora de abertura

### Requirement: Endereço com mapa ilustrativo e rota

O tenant MAY ter um campo `address`; quando presente, a página SHALL exibir o endereço com um mapa ilustrativo (desenhado em CSS/SVG, decorativo, `aria-hidden`, com a legenda "mapa ilustrativo") e o botão "Como chegar" abrindo a rota no app de mapas do aparelho. Quando ausente, o cartão de endereço/mapa SHALL ser omitido — nunca um placeholder quebrado. A página SHALL depender de nenhum serviço externo de mapas para renderizar.

#### Scenario: Endereço configurado

- **WHEN** o tenant tem `address` configurado
- **THEN** a página mostra o endereço, o mapa ilustrativo com pin e o botão "Como chegar" apontando para a rota no app de mapas com o endereço como destino

#### Scenario: Endereço ausente

- **WHEN** o tenant não tem `address`
- **THEN** o cartão de endereço/mapa não é renderizado e o restante da página funciona normalmente

### Requirement: Horário e encaminhamento aos canais próprios

A página SHALL exibir o horário de atendimento (`tenant.openingHours`) com a nota de que os canais online funcionam a qualquer hora, e um aviso encaminhando elogios/reclamações à Ouvidoria e assuntos de dados pessoais ao Canal LGPD. A faixa final "prefere resolver sem sair de casa?" SHALL ligar para solicitar serviço e agendar horário; o botão "Atendimento online" SHALL abrir o chat da serventia e só aparecer quando o chat do tenant estiver ligado.

#### Scenario: Faixa de autosserviço

- **WHEN** o cidadão chega ao fim da página com o chat do tenant ligado
- **THEN** vê os botões "Solicitar serviço" (→ `/solicitar`), "Agendar horário" (→ `/agendar`) e "Atendimento online" (abre o chat na própria página)

#### Scenario: Chat desligado

- **WHEN** o chat do tenant está desligado
- **THEN** a faixa mostra apenas "Solicitar serviço" e "Agendar horário"
