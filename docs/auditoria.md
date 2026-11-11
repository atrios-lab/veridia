# Auditoria e notificações para esclarecimentos

## Quem vê o quê

| Quem | O que vê na aba **Auditoria** |
| --- | --- |
| Tabelião/Registrador (`audit.manage`) | A trilha completa da serventia, as anotações e todas as notificações |
| Demais cargos | Só as notificações endereçadas a eles, com o formulário de resposta |
| Conta mestre da Átrios | A trilha de qualquer serventia, ou de todas juntas (filtro "Serventia") |

A trilha vem da tabela `audit_log`, que nunca é alterada. As anotações ficam à parte, em `audit_notes`.

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

A migração `0041_auditoria_e_notificacoes.sql` só cria tabelas. Ela não apaga nem altera nada.
