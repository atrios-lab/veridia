## Why

O gerador de documentos fora do painel deixou de precisar da data de assinatura, da numeração de
portarias, da marca do documento e do envio do termo aditivo aos fornecedores. Manter essas
perguntas na Adequação ao Provimento só atrasa a titular com campos que o documento final não usa
mais.

## What Changes

- **BREAKING**: remove a Seção 16 "Formalidades" inteira (campos `lastOrdinance`, `signingDate`,
  `branding`) de `src/core/compliance/sections.ts`. A Seção 17 "Anexos" passa a ser a Seção 16; as
  referências fixas a "Seção 17" nos textos de ajuda (etiqueta de equipamento, print do Windows) e
  no componente de anexos passam a dizer "Seção 16".
- **BREAKING**: remove o campo `sendAddendum` ("Quer que a Átrios envie aos fornecedores o termo
  aditivo...?") da Seção 14 "Contratos e fornecedores".
- **BREAKING**: `toGeneratorJson` (`src/core/compliance/export.ts`) para de gerar as chaves
  `aditivo_fornecedores`, `num_portaria_ultima`, `num_portaria_inicial`, `data`, `data_curta` e
  `sem_marca`. O gerador já não as espera.
- O contador "N de 16 seções" e a barra de progresso continuam automáticos (`SECTIONS.length`),
  sem mudança de código fora da lista de seções.

## Capabilities

### Modified Capabilities

- `admin-compliance-intake`: a coleta passa a ter 16 seções em vez de 17 (sem "Formalidades") e a
  Seção 14 não pergunta mais sobre o termo aditivo; a exportação para o gerador não inclui mais os
  campos de formalidades nem o do termo aditivo.

## Impact

- `src/core/compliance/sections.ts`: remove a definição da seção `formalidades` e o campo
  `sendAddendum`; ajusta os dois textos de ajuda que citam "Seção 17".
- `src/core/compliance/export.ts`: remove as seis chaves derivadas de `formalidades` e
  `sendAddendum` do JSON do gerador.
- `src/core/compliance/compliance.test.ts`: remove o fixture `formalidades` e as asserções sobre
  as chaves removidas.
- `src/app/admin/(dashboard)/adequacao/_components/attachments.tsx`: comentário que cita "Seção
  17" passa a "Seção 16".
- `e2e/admin-compliance.spec.ts`: assertiva "0 de 17 seções" passa a "0 de 16 seções".
- Serventias que já responderam a Seção 16 ou o campo do termo aditivo mantêm essas respostas
  gravadas em `compliance_intakes` (JSONB por seção); elas só deixam de aparecer na coleta e na
  exportação.

## Non-Goals

- Migrar ou apagar as respostas já salvas de `formalidades` e `sendAddendum` no banco. A tabela
  não muda; os dados antigos ficam órfãos e sem uso.
- Mudar o vocabulário ou o comportamento do gerador de documentos em si, que vive fora deste
  repositório.
- Renumerar seções além do deslocamento direto causado pela remoção (a Seção 17 vira 16; nenhuma
  outra seção muda de número).
