## ADDED Requirements

### Requirement: Cartão de horário com status ao vivo

A hero da home SHALL exibir um cartão de horário em qualquer largura de tela. Ele SHALL mostrar o
status do balcão no momento do acesso (o mesmo texto da página de contato) e, abaixo, a frase
`openingHours` do tenant. O cartão inteiro SHALL levar à página de contato. No celular ele SHALL
ficar depois do campo de consulta de protocolo, sem tirar o campo da primeira dobra.

#### Scenario: Aberto agora

- **WHEN** um visitante abre a home dentro do horário do balcão
- **THEN** o cartão mostra "Aberto agora · fecha às …" (ou "· intervalo às …") seguido da frase
  de horário

#### Scenario: Fora do horário

- **WHEN** um visitante abre a home com o balcão fechado
- **THEN** o cartão mostra "Fechado agora · abre …" (ou "Em intervalo · volta às …") e lembra que
  os serviços do site seguem funcionando a qualquer hora

#### Scenario: Celular

- **WHEN** a home é aberta numa tela de 390px
- **THEN** o cartão de horário aparece abaixo da busca de protocolo, e a busca continua visível
  sem rolar

#### Scenario: Toque leva ao contato

- **WHEN** o visitante toca no cartão
- **THEN** ele vai para `/contato`, com endereço, mapa e canais
