# Design — Avisos institucionais na transparência

## Context

A página pública `/transparencia` ([src/app/(public)/transparencia/page.tsx]) renderiza hoje
duas seções servidas pelo banco: documentos publicados e boletins mensais. A demanda dos
juízes corregedores é texto institucional visível na própria página — uma declaração de
prevenção à lavagem de dinheiro (Provimento CNJ n. 149/2023) e o aviso de cautelas com
pessoas idosas (Provimento CGJ-RN n. 053/2010).

Fato relevante do CNN (arts. 137–181): nenhum artigo obriga a publicação da declaração no
site; as obrigações são internas (política formalizada, oficial de cumprimento, cadastros,
comunicações à UIF). O art. 154 impõe sigilo sobre as comunicações à UIF — o texto público
deve permanecer genérico.

## Goals / Non-Goals

**Goals:**

- Exibir os dois avisos na página de transparência, com o nome da serventia interpolado e
  link para o texto oficial do Provimento 149/2023 no site do CNJ.
- Diff mínimo: uma seção nova em um arquivo, seguindo o padrão visual da própria página.

**Non-Goals:**

- Campo editável no painel, conteúdo por tenant, tabela nova ou migração (ver não-objetivos
  do proposal).
- Publicar os PDFs dos provimentos como documentos da serventia.

## Decisions

**1. Texto fixo no componente da página, não config por tenant.**
Os avisos reproduzem normas nacional (CNJ) e estadual (CGJ-RN): o conteúdo é idêntico para
todos os tenants, só o nome da serventia varia — e ele já está disponível em `tenant.name`
na página. A convenção "texto visível vem de config" aplica-se a conteúdo editorial da
serventia; rótulos e textos estruturais da página de transparência já são fixos no
componente (títulos, estados vazios), e os avisos seguem esse mesmo padrão. Alternativas
descartadas: campo em `tenant config` (especulativo — nenhum tenant precisa de texto
diferente) e documento PDF via painel (juiz pede texto visível, não link).

**2. Seção "Avisos institucionais" antes de "Documentos".**
É o conteúdo que a corregedoria procura ao abrir a página; documentos e boletim continuam
logo abaixo. Cards no padrão existente (`rounded-2xl border border-brand-border
bg-brand-card`), heading `h2` próprio, cada aviso como bloco com `h3`.

**3. Texto da declaração de lavagem sem a frase "ausência de um manual prévio".**
A frase do rascunho encaminhado confessa publicamente o descumprimento do art. 144, §2º, IV
(dever de elaborar manuais internos) e descreve um momento transitório num aviso permanente.
A versão publicada mantém o compromisso, a referência ao Provimento 149/2023, beneficiários
finais e monitoramento de alto valor. Se a corregedoria exigir texto literal, basta trocar a
string.

**4. Link externo apenas para o Provimento 149/2023.**
URL oficial estável do CNJ (atos.cnj.jus.br). O Provimento 053/2010 da CGJ-RN não tem URL
oficial estável confirmada; o aviso resume as cautelas no próprio texto e não linka. Se a
serventia quiser, o PDF pode ser publicado depois pelo fluxo de documentos existente.

## Risks / Trade-offs

- [Aviso de idosos cita norma do RN] → Todos os tenants atuais são do RN. Tenant de outro
  estado exigirá condicionar ou parametrizar esse aviso; registrado como não-objetivo, o
  custo aparece só quando tal tenant existir.
- [Texto fixo exige deploy para mudar] → Aceitável: mudança de texto normativo é rara e
  passa por revisão de qualquer forma; é o mesmo trade-off dos demais textos da página.
- [Contraste nos 5 temas] → A seção usa somente tokens `brand-*` já auditados para AA
  (mudança #34); nenhuma cor nova é introduzida.
