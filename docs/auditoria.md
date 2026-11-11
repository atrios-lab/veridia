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
