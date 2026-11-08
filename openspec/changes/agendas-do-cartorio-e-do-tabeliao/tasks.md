## 1. Regras

- [x] 1.1 `core/scheduling/services.ts`: catálogo de ofício único com o que levar; base, aviso de 15 minutos; testes
- [x] 1.2 `agenda.ts`: duas agendas, configuração antiga vira a do cartório, grade antiga ainda gravada; testes
- [x] 1.3 `receipt.ts`: comprovante de agendamento; testes

## 2. Banco

- [x] 2.1 Migração 0033: `appointments.agenda` com padrão `geral` (só acrescenta)
- [x] 2.2 Horários ainda divididos entre as agendas enquanto o índice antigo existir (`AGENDAS_SHARE_TIMES`)

## 3. Site

- [x] 3.1 Escolha da agenda, serviços agrupados e prévia do que levar
- [x] 3.2 Confirmação com aviso de 15 minutos, lista e "Baixar comprovante (PDF)"
- [x] 3.3 E-mail com lista, aviso e comprovante anexo

## 4. Painel

- [x] 4.1 Configuração com abas, catálogo para marcar e serviços próprios
- [x] 4.2 Agenda do dia com abas e "Comprovante"; reserva de balcão por agenda

## 5. Verificação

- [x] 5.1 Bateria do CI
- [x] 5.2 Navegador: configurar as duas agendas, agendar no tabelião, baixar e imprimir o comprovante
