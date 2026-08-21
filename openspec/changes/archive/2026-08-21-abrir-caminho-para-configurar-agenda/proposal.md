## Why

O único link para `/admin/agenda/configuracao` em todo o painel vive dentro do aviso "A agenda
ainda não tem horários", que só é renderizado quando `!hasGrid(config)`. Assim que a serventia
salva o primeiro horário, o aviso some e leva junto o caminho de volta: a tela de configuração
continua existindo e funcionando, mas fica inalcançável pela navegação — a serventia relata que
"sumiram os campos para editar". A única saída hoje é apagar todos os horários ou digitar a URL
na mão.

## What Changes

- A agenda do dia (`/admin/agenda`) passa a oferecer, **sempre**, um caminho visível para a tela
  de configuração da agenda, independente de a grade estar vazia ou preenchida.
- O aviso de grade vazia continua existindo com sua chamada de ação: ele é o empurrão para quem
  nunca configurou, não a única porta.
- Nenhuma mudança na tela de configuração em si, nas ações de escrita, no schema da agenda ou na
  página pública de agendamento.

### Não-objetivos

- **Não** adicionar item novo à sidebar (`nav.ts`): os nove itens são o design aprovado e a
  configuração da agenda é subordinada à agenda, não irmã dela.
- **Não** transformar `/admin/agenda` em abas "Dia · Configuração" nem reestruturar a rota.
- **Não** dar slot de ação ao `AdminPageHeader` compartilhado: ele serve todas as telas do
  painel e ganharia superfície por causa de uma.
- **Não** mexer no fluxo de salvar a grade, nem passar a exigir confirmação para salvar grade
  vazia (questão real, mas de outra mudança).

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `admin-agenda`: novo requisito de que a tela de configuração da agenda seja alcançável a
  partir da agenda do dia em qualquer estado da grade. Hoje a spec descreve a grade como
  configurável, mas não exige que a serventia consiga voltar para configurá-la.

## Impact

- `src/app/admin/(dashboard)/agenda/page.tsx`: um link permanente para a configuração.
- `e2e/admin-agenda.spec.ts`: cobertura de que o caminho existe com a grade preenchida.
- Sem impacto em `src/core`, banco, migrações, ações de servidor ou site público.
