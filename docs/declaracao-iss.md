# Declaração de ISS

Decisão de 11/11/2026. Fica em Utilitários › **Declaração de ISS**. Todo mês,
o cartório informa ao fisco municipal o ISS sobre os emolumentos e anexa o
caixa do mês. Assim o Tabelião não precisa redigir um ofício a cada mês para
prefeituras sem sistema automático.

## Como usar

1. **Configuração**, uma vez só:
   - a alíquota (de 2% a 5%);
   - a lei municipal do ISS e, se quiser, o PDF da lei ou do plano diretor;
   - a prefeitura e a secretaria;
   - o CNPJ, a inscrição municipal e o CNAE da serventia.
2. **Nova declaração**, todo mês:
   - a competência e o **total de emolumentos do mês**. O ISS é calculado
     enquanto se digita;
   - opcional: o DAM, o vencimento, a data do recolhimento e observações;
   - anexe o **Livro Diário Auxiliar ou o relatório do caixa** do mês, em
     PDF.
3. O PDF sai com a declaração e, atrás, o livro anexo. Ele traz **Assinar
   digitalmente** (A1 ou A3) e **Imprimir para assinar à mão**.
4. **Lançar no boletim mensal**, marcado por padrão:
   - se o boletim do mês já foi publicado, o ISS dele é atualizado;
   - se ainda não foi, o formulário do boletim desse mês já abre com o ISS
     preenchido.

A declaração **não lista os serviços**, porque o caixa anexo já os traz. Ela
declara o total e ratifica o anexo.

## Base de cálculo

- O ISS incide só sobre os **emolumentos**, que são o preço do serviço: LC
  116/2003, art. 7º; STJ, Primeira Seção, REsp 1.328.384/RS (2013).
- Não entram na base os repasses ao Estado e aos fundos nem o selo. No RN, os
  fundos são FDJ, FRMP, FCRCPN e FUNAF (Lei Estadual nº 11.038/2021). Esses
  valores são receita de terceiros, com natureza tributária própria.
- A base também não é a arrecadação bruta. Pelos conceitos do Justiça Aberta
  (CNJ), arrecadação bruta é o total sem nenhum abatimento, e inclui esses
  repasses.

## Relatórios do sistema (Notaris)

Ao anexar o **Relatório de Produtividade** e o de **Valores Tributários no
Período**, o formulário lê os PDFs e se preenche sozinho. Tudo continua
editável.

- Competência: do período "De: 01/mm/aaaa".
- Emolumentos: coluna Emol. da linha TOTAL.
- Alíquota: cabeçalho "ISSQN 5,00%".
- ISS: coluna ISSQN da linha TOTAL, **apurado ato a ato**. Alguns atos não
  têm ISS (certidão sem PGE, ato gratuito), então o ISS do mês pode ser menor
  que a alíquota sobre o total. A declaração diz isso.
- Boletim mensal: atos, FDJ, FRMP, FCRCPN, FPGE (o FUNAF do boletim),
  arrecadação e custeio.

Os PDFs podem ser vários (livro, produtividade, valores tributários). Todos
vão atrás da declaração, no mesmo PDF, na ordem escolhida.

No boletim, "Arrecadação do mês" recebe o **[E] Arrec. Tot. Bruta** (A + D +
ISSQN), e "Despesas" recebe o **[C] Custeio**. Assim o saldo do boletim
(arrecadação menos fundos, ISS e despesas) fica igual ao que sobra para a
serventia.

O boletim **não é publicado sozinho**. Se o mês ainda não foi publicado, os
números ficam guardados e o formulário do boletim abre com eles. Se o mês já
foi publicado, só o ISS é atualizado, e os demais números ficam como o
cartório conferiu.

Se o relatório não for reconhecido (outro sistema, PDF escaneado), ele vai
anexo do mesmo jeito e os valores são digitados.

## Fundamentação que sai no PDF

- Constituição Federal, art. 156, III.
- LC 116/2003: art. 1º, item 21.01, art. 7º e art. 8º-A.
- STF, ADI 3.089/DF.
- STJ, REsp 1.328.384/RS.
- Lei 8.935/1994, art. 28; Lei 10.169/2000.
- Lei Estadual nº 11.038/2021 (RN).
- Código Nacional de Normas (Provimento CNJ 149/2023), com a redação do
  Provimento CN-CNJ nº 259/2026, de 05/11/2026: as informações do Livro
  Diário Auxiliar podem subsidiar a apuração de tributos, sem que ele se
  torne escrituração fiscal.
- A lei municipal informada na configuração.

**A conferir:** a lei de ISS de Ielmo Marinho não foi encontrada na pesquisa
pública. A alíquota fica em 5%, que é o padrão do sistema e o comum no RN,
até o Tabelião informar a lei e a alíquota na configuração.

## Técnico

- Tabela `iss_declarations` (migração 0049, só cria a tabela; migração 0050
  só acrescenta as colunas `iss_from_report` e `attachments`).
- Numeração anual na série `declaracao-iss`, que aparece em Configurações ›
  Numeração.
- "Excluir" não apaga do banco: a declaração sai da lista, o número fica
  livre e o registro fica na auditoria.
- A configuração fica em `tenant_content` (`office-iss`). O que espera a
  publicação do boletim (ISS e, vindo do relatório, os demais números) fica
  em `office-iss-bulletin`.
- Leitura dos relatórios: `src/core/iss/notaris-report.ts` (testes com
  números fictícios).
- Auditoria: emitir, corrigir (faixa Atenção), excluir e lançar no boletim.
