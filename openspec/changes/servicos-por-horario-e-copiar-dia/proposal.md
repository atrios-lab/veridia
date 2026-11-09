## Why

Configurar a semana exigia digitar os horários de cada dia, um por um, mesmo quando a terça
repete a segunda. E todo horário oferecia todos os serviços da agenda: não dava para reservar,
por exemplo, 08:30 só para reconhecimento de firma.

## What Changes

- **Sugestão do dia anterior**: um dia ainda sem horários mostra, como sugestão, os horários do
  dia anterior que já tem horários (na terça, os de segunda), com o botão "Usar os mesmos de
  segunda". A cópia leva também os serviços de cada horário.
- **Serviços por horário**: no painel, clicar num horário abre a lista dos serviços da agenda
  para marcar o que aquele horário atende. Sem marcação, o horário atende todos. O horário
  restrito mostra o serviço ("08:30 · Reconhecimento de firma").
- **Site**: o horário restrito mostra "Só Reconhecimento de firma"; ao escolhê-lo, a lista de
  serviços fica só com os permitidos, e a escolha recomeça quando o cidadão troca para um
  horário com outra lista. O servidor recusa um serviço que o horário não atende.
- **Limpeza**: ao salvar, sai a restrição de horário que saiu da grade e o serviço que a
  agenda não oferece mais; um horário que fica sem serviço restrito, ou com todos, volta a
  atender todos.
- **Banco**: nenhuma migração. Fica na configuração da agenda (`slotServices`), e configurações
  antigas continuam valendo (todos os horários atendem todos os serviços).
