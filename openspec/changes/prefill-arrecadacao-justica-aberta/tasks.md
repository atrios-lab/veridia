## 1. O dado no config

- [x] 1.1 `revenue` opcional no `TenantSchema` (`src/core/tenant/schema.ts`): dois semestres, `source` e `extractedOn`, com teste de parse do campo ausente e do campo completo
- [x] 1.2 Preencher os seis arquivos de serventia atendida com os valores da extração de 10/07/2026: Marinho, Bento Fernandes, Bom Jesus, Santa Cruz 2º Ofício, Major Sales e Taipu
- [x] 1.3 Conferir cada valor contra a base de prospecção antes de commitar: é o número que decide prazo e obrigação

## 2. Pré-preenchimento

- [x] 2.1 `PrefillSource` e `prefillAnswers` (`src/core/compliance/answers.ts`) passam a levar os dois semestres; zero e ausente produzem campo vazio, cada semestre avaliado por si
- [x] 2.2 `prefillFor` (`src/lib/compliance.ts`) repassa o campo do tenant
- [x] 2.3 Teste: valor presente preenche; zero não preenche; um semestre ausente não afeta o outro; o que a serventia gravou vence o pré-preenchido

## 3. Origem e data na tela

- [x] 3.1 A Seção 1 mostra, sob cada campo de receita preenchido pela origem, de onde veio e a data da extração, com o convite a corrigir
- [x] 3.2 Campo vazio por ausência na origem mostra a nota de que não havia declaração para o período na data da extração
- [x] 3.3 A nota some quando a serventia digita o próprio valor

## 4. Aviso de fronteira

- [x] 4.1 `classBoundary(revenue)` pura em `src/core/compliance/classification.ts`, com teste nos dois tetos, dos dois lados, e no caso longe de qualquer um
- [x] 4.2 A Seção 1 exibe o aviso no mesmo desenho dos avisos de pendência, sem bloquear seção nem envio
- [ ] 4.3 Conferir o texto do aviso com a Átrios: ele nomeia consequência legal (prazo e obrigatoriedade do encarregado)

## 5. Verificação

- [x] 5.1 e2e: serventia com receita no config abre a Seção 1 e vê o valor com a nota de origem; corrige e a classe acompanha
- [x] 5.2 Conferir na tela, com uma serventia de cada situação: valor presente, zero na origem, e valor perto do teto
- [x] 5.3 Registrar no README ou em `docs/` o ritual semestral: quando a base de prospecção for atualizada, os configs e a `extractedOn` mudam junto
