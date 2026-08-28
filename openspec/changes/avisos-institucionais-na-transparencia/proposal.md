# Avisos institucionais na página de transparência

## Why

Os juízes corregedores estão cobrando que os sites das serventias exibam, na aba de
transparência, uma declaração pública de prevenção à lavagem de dinheiro alinhada ao Código
Nacional de Normas do CNJ (Provimento n. 149/2023), nos moldes do aviso sobre atos notariais
com pessoas idosas (Provimento n. 053/2010 da CGJ-RN). Hoje a página de transparência só lista
documentos PDF e o boletim mensal — não há lugar para texto institucional visível na página.

## What Changes

- A página pública `/transparencia` ganha uma seção "Avisos institucionais", antes de
  "Documentos", com dois avisos em texto fixo:
  - **Prevenção à lavagem de dinheiro**: declaração de compromisso da serventia com a
    identificação e comunicação de operações suspeitas, na forma do Provimento CNJ
    n. 149/2023, com link para o texto oficial no site do CNJ.
  - **Atos com pessoas idosas**: resumo das cautelas do Provimento n. 053/2010 da CGJ-RN
    para atos notariais envolvendo pessoas com 60 anos ou mais.
- O nome da serventia é interpolado do tenant; o restante do texto é idêntico para todos os
  tenants (normas nacional e estadual, não conteúdo editorial da serventia).
- O texto de lavagem de dinheiro é deliberadamente genérico: não cita operações, valores nem
  casos, porque as comunicações à UIF são sigilosas (art. 154 do CNN).

## Capabilities

### New Capabilities

- `transparency-notices`: avisos institucionais fixos exibidos na página pública de
  transparência (prevenção à lavagem de dinheiro e cautelas com pessoas idosas).

### Modified Capabilities

Nenhuma. As capabilities `transparency-documents` e `transparency-bulletin` (delta specs da
change `add-transparency-module`) não mudam de requisito; a seção nova convive com as
existentes na mesma página.

## Não-objetivos

- **Campo editável no painel**: os textos são normativos e iguais para todas as serventias;
  não há sinal de necessidade de edição por tenant. Se um dia surgir, vira change própria.
- **Publicar os provimentos como documentos PDF**: os avisos são texto na página com link
  externo; o fluxo de documentos do painel continua servindo para tabelas e relatórios.
- **Variação por estado**: o aviso de idosos cita norma do RN, e todos os tenants atuais são
  do RN. Tenant de outro estado, quando existir, exigirá revisitar esse aviso (registrado no
  design como risco conhecido).
- **Conteúdo dinâmico ou banco de dados**: nenhuma tabela, migração ou server action nova.

## Impact

- `src/app/(public)/transparencia/page.tsx`: seção nova de avisos (única mudança de código).
- E2E: cobertura da página pública de transparência ganha asserções da seção nova.
- Sem mudança de banco, sem dependência nova, sem impacto no painel admin.
