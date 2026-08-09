## Why

O requerimento em PDF é o único artefato do sistema que o cidadão imprime, assina e devolve — e hoje ele sai como texto corrido em Helvetica preta, sem nenhuma marca da serventia. É o documento que mais circula fora da tela e o único que não veste a identidade visual que o resto da plataforma respeita.

Pior: a chave de acesso é impressa no meio do bloco "Pedido", na mesma página que o cidadão assina e anexa de volta pelo site. Ou seja, o documento que volta para a serventia — e que pode ser reencaminhado, fotografado ou impresso no balcão — carrega a credencial que abre a consulta do protocolo à mostra.

## What Changes

- O documento passa a sair na paleta do tema da serventia (cabeçalho institucional com a cor primária, réguas e rótulos no tom de destaque, logotipo da serventia no topo), seguindo o mesmo design system do site: estrutura fixa, cor vinda do tenant.
- Protocolo e chave de acesso saem do corpo do requerimento e passam para uma **página própria, a última do arquivo**, apresentada como comprovante destacável — de forma que a folha assinada possa ser anexada sem a credencial à mostra.
- A página de credenciais explica em uma linha por que está separada e o que o cidadão deve fazer com ela (guardar; não anexar).
- O modelo de documento (`RequerimentoDocument`) ganha um bloco de credenciais explícito, em vez de esconder a chave numa linha de tabela como qualquer outro campo.
- O recibo do Encarregado (LGPD) herda a mesma identidade visual pelo renderizador compartilhado. Suas credenciais **continuam no corpo**: o recibo não é assinado nem devolvido, é a prova que o titular guarda.
- **Não-objetivos**:
  - Não muda o texto legal, as declarações, os campos coletados nem o fluxo de assinatura (Gov.br / próprio punho).
  - Não introduz biblioteca nova de PDF nem renderização por HTML/headless browser.
  - Não protege o PDF com senha, não criptografa nem marca d'água a chave.
  - Não altera as rotas, o formato do protocolo, o hash da chave nem a regra de acesso (POST + chave, 404 genérico).
  - Não cria seletor de tema para o documento: ele usa o tema do tenant, como todo o resto.

## Capabilities

### New Capabilities
<!-- Nenhuma. -->

### Modified Capabilities
- `service-request`: o requerimento em PDF passa a exigir identidade visual da serventia e, sobretudo, credenciais (protocolo e chave) em página separada da folha assinada.

## Impact

- `src/core/request/requerimento.ts`: `RequerimentoDocument` ganha bloco de credenciais opcional; `buildRequerimento` deixa de empilhar protocolo/chave em "Pedido".
- `src/lib/pdf.ts`: `renderDocument` passa a receber a paleta do tenant, desenhar cabeçalho de marca, logotipo e rodapé, e emitir a página de credenciais quando existir.
- `src/app/(public)/solicitar/requerimento/route.ts` e `src/app/(public)/lgpd/recibo/route.ts`: passam o tenant/paleta ao renderizador.
- Novo `src/core/tenant/palette.ts`: os hexes dos cinco temas passam a existir também em TypeScript, porque o PDFKit não lê CSS. Um teste compara esse mapa com os `--palette-*` de `src/app/globals.css` e falha se divergirem — a folha de estilo continua sendo a referência.
- `src/core/request/requerimento.test.ts`: testes que hoje procuram protocolo e chave no corpo passam a procurá-los no bloco de credenciais.
- Nova dependência `qrcode` (server-side), para o QR do papel timbrado que aponta para a consulta do protocolo.
- Sem migração de banco. Sem mudança de contrato HTTP.
