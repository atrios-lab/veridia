## Why

A serventia quer protocolar, prenotar, qualificar e registrar pelo sistema de RI (pedido de
25/11/2026: "protocolo ou prenota para análise, análise, e eu só informo os selos e ele já faz
tudo"). Hoje o número de protocolo é só um texto digitado no ato.

## What Changes

- **Protocolo (Livro 1):**
  - número de ordem automático, com uma série para prenotação e outra para exame e cálculo (Lei nº
    6.015/1973, arts. 12, parágrafo único, 174, 175, 182 e 186);
  - apresentante, natureza do título (art. 221), atos pedidos e matrículas.
- **Prazos em dias úteis**, com os feriados da serventia (art. 9º, § 1º):
  - qualificação em 10 dias, ou 5 nos casos do art. 188, § 1º;
  - prenotação em 20 dias, ou 40 na Reurb social (art. 205);
  - reingresso com as exigências cumpridas: registro em 5 dias (art. 188, § 1º, III).
- **Conferência nas matrículas:**
  - matrícula encerrada (art. 233);
  - indisponibilidade (art. 247; CNN, arts. 320-A a 320-F);
  - ônus em vigor;
  - lembrete da consulta à CNIB (CNN, art. 320-F).
- **Nota devolutiva** com todas as exigências de uma vez e a fonte de cada uma (art. 198), em PDF
  para imprimir, assinar digitalmente ou sair com a imagem da assinatura.
- **Registro:**
  - o ato é lançado na matrícula com o número do protocolo e o selo informado pela serventia;
  - o protocolo só se conclui como registrado quando todos os atos têm selo.
- **Situações** com motivo: desistência, dúvida, prenotação cessada, exame concluído e reabrir.
  "Apagar" só marca o protocolo como lançado por engano, e ele pode ser restaurado.
- Histórico de cada alteração e rótulos de auditoria em português.
- Lembrete da tabela de emolumentos vigente junto dos emolumentos.
- Item no menu e contadores na Mesa.

## Capabilities

### Modified Capabilities
- `registro-de-imoveis`

## Impact

- Banco: migração 0087, que só acrescenta a tabela `ri_protocols` e a coluna `protocol_id` em
  `ri_files`. Usa `IF NOT EXISTS`.
- Código:
  - `src/core/ri/protocol.ts`, `src/lib/ri-protocols.ts`;
  - telas em `/admin/ri/protocolo`;
  - PDF da nota devolutiva.
