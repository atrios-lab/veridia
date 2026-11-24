## Decisões

**Agenda fixa, não lista.** `AGENDA_IDS` ganha `enotariado`. A estrutura de cada agenda
(`AgendaBook`) já é genérica; o resto do sistema percorre `AGENDA_IDS`. A reserva de vaga
(`bookAppointmentWith`) conta por agenda e numera a vaga por horário entre todas, então serve
para três sem mudança.

**Canais por agenda (`AGENDA_CHANNELS`).** Balcão: os modos da serventia (sem canais). Tabelião:
presencial, vídeo e ligação. e-Notariado: presencial e "Videoconferência no e-Notariado", um
canal próprio em vez de "Por vídeo", para que o aviso ao cidadão (que só recebe o rótulo do
modo) diga que o convite vem da plataforma. O salvamento passa os canais por
`allowedChannels`, para a agenda nunca guardar um canal que não pode oferecer.

**Certificado presencial.** O art. 285, II define o certificado como identidade de pessoa
"identificada presencialmente por um notário". A observação do serviço pede que a pessoa venha
ao cartório; o "Como fazer" manda conferir o documento com a pessoa presente.

**Fontes.** Cada passo do "Como fazer" traz o artigo do Código Nacional de Normas, conferido no
texto oficial do CNJ. A cobrança cita a tabela de emolumentos vigente e o painel mostra o
`FeeTableReminder` junto.
