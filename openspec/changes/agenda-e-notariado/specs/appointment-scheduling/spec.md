## ADDED Requirements

### Requirement: Agenda do e-Notariado e certificado digital
A serventia DEVE (SHALL) ter uma terceira agenda, "e-Notariado e certificado digital", com os
seus dias, horários, vagas e serviços, configurada como as outras e oferecida no site só quando
tem horários e serviços. Os serviços do e-Notariado DEVEM (SHALL) estar no catálogo, num grupo
próprio: emissão do Certificado Digital Notarizado, renovação ou nova emissão, assinatura de
ato eletrônico por videoconferência, reconhecimento de assinatura eletrônica (e-Not Assina),
reconhecimento de firma por autenticidade por videoconferência, Autorização Eletrônica de
Viagem, autenticação digital pela CENAD, ajuda para o cadastro e "Outro serviço do
e-Notariado (não listado acima)". A agenda DEVE (SHALL) oferecer só o atendimento presencial e a
videoconferência no e-Notariado, nunca ligação telefônica.

#### Scenario: Cidadão agenda a emissão do certificado
- **WHEN** a serventia configurou horários na agenda do e-Notariado com o serviço de emissão
  do certificado
- **THEN** o site mostra a agenda "e-Notariado e certificado digital", o serviço como gratuito
  e a observação de que a identificação é presencial perante o notário

#### Scenario: Serviço não listado
- **WHEN** o cidadão escolhe "Outro serviço do e-Notariado (não listado acima)"
- **THEN** o agendamento é aceito com o que ele escreveu no campo de detalhes, e o painel
  mostra o "Como fazer" para conferir se o ato se pratica pelo e-Notariado

#### Scenario: Videoconferência pelo e-Notariado
- **WHEN** o cidadão agenda pelo canal "Videoconferência no e-Notariado"
- **THEN** o e-mail, o lembrete e o comprovante dizem que a videoconferência acontece na
  plataforma e-Notariado e que o convite chega por ela

#### Scenario: Como fazer no painel
- **WHEN** o funcionário abre um agendamento de serviço do e-Notariado
- **THEN** vê o passo a passo com o artigo do Código Nacional de Normas em cada passo e, se o
  ato é cobrado, o lembrete de conferir a tabela de emolumentos vigente

### Requirement: Ligar e desligar cada agenda
Cada agenda DEVE (SHALL) poder ser desligada (pausada) e religada pela serventia. Desligada, ela
NÃO DEVE (SHALL NOT) aparecer no site nem aceitar agendamento pelo site, e DEVE (SHALL) manter
os horários, os serviços e os agendamentos já feitos. Uma agenda com horários e sem pausa DEVE
(SHALL) estar ligada. O painel DEVE (SHALL) mostrar a agenda do e-Notariado só à serventia que a
usa (com horários ou agendamentos).

#### Scenario: Pausar a agenda do e-Notariado
- **WHEN** a serventia clica em "Desligar (pausar)" na agenda do e-Notariado e salva
- **THEN** o site deixa de oferecer essa agenda, e o painel mostra a agenda como "desligada"
  com os horários e agendamentos guardados

#### Scenario: Cartório que não usa o e-Notariado
- **WHEN** a serventia nunca configurou horários na agenda do e-Notariado
- **THEN** nem o site nem a agenda do dia no painel mostram essa agenda
