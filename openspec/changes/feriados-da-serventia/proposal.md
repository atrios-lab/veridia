## Why

O calendário conhece os feriados nacionais e os dias do Código de Normas do RN, mas não os do
município (padroeiro, aniversário da cidade, Dia do Evangélico onde há lei local) nem pontos
facultativos decretados. O §6º, III, do Provimento 156/2016 fecha a serventia nos feriados
municipais, e hoje nesses dias o site diz "Aberto agora", o chat abre, a agenda oferece horário e
os prazos correm.

## What Changes

- Nova seção no painel, Configurações › Serventia: **Feriados e dias sem expediente**.
  - Mostra os dias já considerados (nacionais e do Código de Normas do RN) dos próximos 12 meses,
    para a serventia não cadastrar de novo o que já conta (ex.: Nossa Senhora Aparecida, 12/10).
  - Lista editável de feriados próprios: nome, data e "Todo ano" (repete no mesmo dia e mês) ou
    data única (ponto facultativo). Atalhos para os nomes mais comuns: padroeiro(a), aniversário
    do município, Dia do Evangélico.
  - Salvar grava a lista inteira, com auditoria.
- `Tenant.customHolidays` (padrão vazio) e todo cálculo de dia útil passa a considerá-los:
  status do balcão e chat, agenda (pública, do painel e prévia da configuração), prazos dos
  pedidos (fila, detalhe, consulta do cidadão, retomada após pausa) e editais.
- No dia de um feriado próprio, o status diz o nome, como nos demais: "Fechado hoje, feriado de
  Dia do Evangélico · abre terça às 8h".

## Não-objetivos

- Pré-carregar feriados municipais de cada cidade. A data é de cada município e a serventia é
  quem sabe; um palpite fecharia o balcão no dia errado.
- Feriados com data móvel própria (fora da Páscoa). Cadastra-se como data única, ano a ano.
- Abertura parcial (meio expediente) num feriado.
- Qualquer alteração de banco que apague ou renomeie coluna, tabela ou dado. A lista vive em
  `tenant_content` (JSON), como as demais configurações; nenhuma migração.

## Capabilities

### New Capabilities

- `office-holidays`: feriados próprios da serventia e seu efeito em todo cálculo de dia útil.

### Modified Capabilities

- `admin-office-settings`: nova seção de feriados na aba Serventia.

## Impact

- `src/core/scheduling/calendar.ts`: `CustomHoliday`, `OfficeHolidays`, `upcomingClosedDays`;
  `holidayName`, `isHoliday`, `isBusinessDay` e `nextBusinessDays` recebem os feriados próprios.
- `src/core/request/deadline.ts`, `src/core/overview/urgency.ts`,
  `src/core/publications/{notice-schedule,notice-types,expiry}.ts`,
  `src/core/scheduling/slots.ts` (`OfficeAgenda`), `src/core/chat/hours.ts`: repassam os feriados.
- `src/core/tenant/{schema,overrides}.ts`, `src/lib/{tenant,office-config}.ts`: campo, override e
  chave `office-holidays`.
- Telas e ações que contam dia útil passam `tenant.customHolidays`.
- `src/app/admin/(dashboard)/configuracoes/`: formulário e action.
