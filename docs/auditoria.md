# Auditoria e notificações para esclarecimentos

## Quem vê o quê

| Quem | O que vê na aba **Auditoria** |
| --- | --- |
| Tabelião/Registrador (`audit.manage`) | A trilha completa da serventia, as anotações e todas as notificações |
| Demais cargos | Só as notificações endereçadas a eles, com o formulário de resposta |
| Conta mestre da Átrios | A trilha de qualquer serventia, ou de todas juntas (filtro "Serventia") |

A trilha vem da tabela `audit_log`, que nunca é alterada. As anotações ficam à parte, em `audit_notes`.

## Faixas: Urgente, Atenção e Análise

Cada ato da trilha cai numa faixa (`src/core/audit/severity.ts`):

| Faixa | O que entra | O que acontece |
| --- | --- | --- |
| Urgente | Toda exclusão (protocolo, anexo, exigência, guia, publicação, documento, conta), chave Pix, criar, reativar ou desativar conta, troca de e-mail, link de nova senha, certificado digital, acesso a outra serventia, duas etapas desligada | Aviso vermelho em todas as telas do Tabelião/Registrador até ele marcar como verificado (atos dos últimos 30 dias, menos os dele mesmo) |
| Atenção | Valor, prazo, gratuidade, nova chave de acesso, correção e número de guia, permissões dos cargos, tabela de emolumentos, edição de conta | Destaque amarelo e contagem por pessoa |
| Análise | Publicações, transparência, configurações, identidade visual, encarregado, agenda | Destaque discreto, para revisar com calma |
| Rotina | Entradas no painel e atos do dia a dia | Sem destaque |

Um ato novo cujo código termine em `delete`, `remove` ou `detach` cai em Urgente sem que ninguém precise lembrar
desta lista.

## Justificativa em toda exclusão

Toda confirmação de exclusão (e de desativar, arquivar, renumerar) pede uma justificativa de pelo menos 10
letras e avisa: "Este ato vai para a auditoria. O Tabelião/Registrador verá o que foi feito, por quem, quando e
a sua justificativa." O servidor recusa o ato sem justificativa (`justify()` em `src/lib/audit-reason.ts`), e
o texto fica na coluna `reason` do registro.

## O que o Tabelião/Registrador faz

1. Filtra a trilha por pessoa, período ou texto (protocolo, ação).
2. Anota em qualquer registro.
3. Marca os registros e escolhe uma ação:
   - **Gerar PDF**: abre o relatório para imprimir ou salvar;
   - **Enviar por e-mail**: manda o relatório em PDF para o endereço digitado;
   - **Notificar a pessoa**: só aparece quando todos os registros marcados são da mesma pessoa.
4. Na notificação, revisa o assunto, os fatos e a fundamentação e anexa imagens ou provas.
5. Ao enviar, a notificação recebe o número do ano (série `notificacao`, por exemplo 001/2026) e o prazo de 24
   horas. Ela segue para o e-mail da conta da pessoa com o PDF.
6. No detalhe da notificação, pode:
   - reenviar o e-mail;
   - abrir o PDF para imprimir;
   - assinar com um certificado A1 do assinador. Depois de assinado, o link do PDF entrega a via assinada;
   - encerrar com uma conclusão.

## Fundamentação padrão (editável a cada notificação)

- Constituição Federal, art. 5º, LV: contraditório e ampla defesa.
- Lei 8.935/1994, arts. 20 e 21: o titular contrata, dirige e responde pelos prepostos.
- CLT, art. 2º: poder de direção do empregador.
- LGPD (Lei 13.709/2018), arts. 37 e 46: registro das operações e segurança dos dados.

O texto fica em `DEFAULT_LEGAL_BASIS` (`src/core/audit/labels.ts`). Ajuste ao caso. Se a serventia tiver
regimento interno, cite-o também.

## A pessoa notificada

- Vê o número de notificações em aberto ao lado do item **Auditoria**.
- Responde uma única vez, com texto e anexos, pela própria aba.
- Quando a resposta chega, o Tabelião/Registrador recebe um e-mail.

## Banco

As migrações `0041_auditoria_e_notificacoes.sql` e `0043_auditoria_niveis_e_justificativa.sql` só criam
tabelas (`audit_reviews`) e acrescentam colunas (`audit_log.reason`). Não apagam nem alteram nada.

## Atualização de 11/11/2026

- **Em português:** nada aparece em código. Cada ato mostra o nome, o alvo em palavras e "O que significa", no painel e no PDF.
- **Marcar todos:** marca a lista inteira. Com os registros marcados, dá para:
  - "Marcar como lido e ok", em qualquer faixa;
  - notificar uma pessoa ou várias (uma notificação para cada);
  - "Arquivar (excluir da lista)".
- **Arquivar não apaga:**
  - o registro sai da lista e fica em "Arquivados", de onde volta com "Desarquivar";
  - as colunas ficam em `audit_reviews.archived_at` e `archived_by`.
- **Anotações:**
  - o Tabelião/Registrador edita, e a marca "editada em" fica visível;
  - pode também excluir. A anotação some da tela e do relatório, mas continua no banco (`audit_notes.removed_at`).
- **Notificação:**
  - vai sempre pelo painel: aba Auditoria e uma faixa em todas as telas da pessoa até ela responder;
  - por e-mail só quando marcado;
  - para imprimir, use "Abrir PDF (imprimir)" na notificação.
- **A migração `0045` só acrescenta colunas.**

## Atualização de 11/11/2026: só os urgentes alertam

- **Urgente** fica só para os atos que podem esconder erro, fraude, dolo,
  culpa ou má intenção: exclusão de pedidos, guias, documentos, anexos e
  publicações, chave Pix, contas, e-mails, acesso ao painel e certificado.
  Só esta faixa alerta o Tabelião/Registrador, até ele verificar.
- Saíram do Urgente:
  - exclusão de material de treinamento (curso, pergunta, tutorial), que
    foi para Análise;
  - desativar um usuário, que foi para Atenção.
- **Atenção** e **Análise** não alertam. Ficam para pesquisa, e o balão de
  cada uma mostra quantos atos ainda faltam conferir.
- **Analisadas e concluídas**: novo balão. O que for marcado como "lido e
  ok", um por um ou com "Marcar todos", sai da faixa e passa a contar aqui.
  O filtro "Analisadas" lista esses atos.
- **Por pessoa** virou uma lista para escolher, em vez de um cartão por
  pessoa. Funciona do mesmo jeito com 2 ou com 50 funcionários. Quem tem
  urgente esperando aparece primeiro, marcado com ⚠.
