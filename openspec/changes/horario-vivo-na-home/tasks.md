## 1. Núcleo: intervalo e status

- [x] 1.1 `CounterHoursSchema` com `lunchBreak` opcional (`HH:MM`, fim depois do início, dentro do expediente), com testes
- [x] 1.2 `applyTenantOverrides`: override sem a chave `lunchBreak` herda o intervalo da config se couber; `null` zera; testes
- [x] 1.3 `counterIntervals`, `isWithinChatHours` e `nextChatOpening` em minutos, com `minute` na próxima abertura; testes de intervalo, meia hora e fim de semana
- [x] 1.4 `counterStatus`, `counterStatusLabel` e `formatClock`; testes dos quatro textos
- [x] 1.5 JSON-LD com duas `OpeningHoursSpecification` quando há intervalo; teste

## 2. Configuração das serventias

- [x] 2.1 Intervalo em Canguaretama, Brejinho, Taipu, Tibau do Sul e Macaíba 1º, e comentários antigos atualizados
- [x] 2.2 Teste parametrizado: todo tenant com intervalo passa no schema

## 3. Site público

- [x] 3.1 Cartão da home: visível no celular, status ao vivo, frase do horário, dica fora do horário, link para `/contato`, texto de 13px
- [x] 3.2 Página de contato e widget do chat lendo `counterStatusLabel` / `formatClock`

## 4. Painel

- [x] 4.1 Campos "Intervalo, das / às" no bloco Atendimento e contato
- [x] 4.2 Action: parse do intervalo (vazio → `null`, metade → erro no campo), gravação explícita

## 5. Verificação

- [x] 5.1 Bateria do CI (typecheck, lint, test, check:dashes, check:tokens, check:destructive, openspec validate, build)
- [x] 5.2 Conferência visual da home em 390px e desktop no estado fechado (os textos de aberto e intervalo ficam cobertos pelos testes do núcleo)
