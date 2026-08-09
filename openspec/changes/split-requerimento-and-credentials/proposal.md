## Why

Hoje o requerimento sai como um arquivo só, com a chave de acesso numa última página destacável. Destacar resolve no papel; não resolve no arquivo. Quem assina digitalmente pelo Gov.br assina o PDF inteiro, com a credencial dentro, e é esse arquivo que volta para a serventia pelo site — exatamente o caso que a página separada queria evitar.

Dois arquivos resolvem na origem: o que se assina nunca teve a chave, e não existe passo manual entre baixar e enviar.

## What Changes

- O requerimento em PDF passa a conter **apenas** o requerimento. A página de credenciais sai do arquivo.
- Novo documento independente, o **comprovante de acesso**: um PDF de uma página, com o mesmo papel timbrado da serventia, trazendo protocolo, chave e a orientação de guardá-lo.
- A rota de download passa a aceitar qual dos dois documentos gerar, e o nome do arquivo baixado diz qual é (`requerimento-<protocolo>.pdf` e `comprovante-<protocolo>.pdf`).
- O comprovante é oferecido **apenas** na tela de sucesso, ao lado do requerimento: ele é emitido uma vez, quando o pedido nasce, ou pelo balcão quando a serventia emite o serviço. A consulta de protocolo continua oferecendo só o requerimento.
- A microcopy acompanha: a tela de sucesso não diz mais que a chave "vai impressa no PDF do requerimento", e o requerimento não fala mais em destacar página.
- **Não-objetivos**:
  - Não muda o texto legal, as declarações, os campos coletados nem o fluxo de assinatura.
  - Não muda a identidade visual dos documentos (papel timbrado, selo, QR, paleta do tema): o comprovante herda o mesmo desenho.
  - Não muda a proteção do download (POST + chave, 404 genérico), nem o armazenamento da chave.
  - Não mexe no recibo do Encarregado (LGPD): ele não é assinado nem devolvido, e suas credenciais seguem no corpo.
  - Não gera um ZIP nem dispara os dois downloads de uma vez.

## Capabilities

### New Capabilities
<!-- Nenhuma. -->

### Modified Capabilities
- `service-request`: o requerimento em PDF deixa de conter as credenciais, que passam a ser um segundo arquivo baixável.

## Impact

- `src/core/request/requerimento.ts`: `buildRequerimento` deixa de preencher `credentials`; nova `buildAccessReceipt` monta o comprovante como documento próprio.
- `src/lib/pdf.ts`: o bloco `credentials` deixa de forçar uma página nova e passa a ser desenhado no fluxo, porque agora ele é o conteúdo do documento, não um apêndice.
- `src/app/(public)/solicitar/requerimento/route.ts`: passa a escolher o documento pelo corpo da requisição e a nomear o arquivo conforme a escolha.
- `src/app/(public)/solicitar/request-form.tsx` e `src/app/(public)/protocolo/protocol-lookup.tsx`: segundo botão de download nos três pontos, e ajuste da microcopy.
- `src/core/request/requerimento.test.ts`: o teste que hoje procura a chave em `credentials` do requerimento passa a mirar o novo documento.
- Sem migração de banco. Sem dependência nova. Sem mudança no contrato de autenticação do download.
