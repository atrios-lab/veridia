## Why

Três problemas relatados pelo usuário em 07/11/2026 na tela de publicações:

1. A seção da página inicial se chamava sempre "Proclamas e avisos", qualquer que fosse o tipo publicado. Quem publicava um edital via o site anunciar proclamas e aviso.
2. Os editais não tinham prazo. Só os proclamas ganhavam uma saída sugerida (15 dias). Editais com mais de uma publicação, como a notificação por edital na usucapião (duas publicações de 15 dias cada, art. 216-A, § 13, da Lei 6.015/1973), dependiam de o operador fazer a conta e republicar à mão. Também não havia como registrar um edital já publicado antes, porque a data de entrada não aceitava dia passado.
3. O anexo (PDF ou imagem) não aparecia na página inicial: o cartão mostrava só tipo, data, título e texto.

## What Changes

- **Título da seção pelo que está no ar.** "Proclamas", "Avisos", "Editais" ou a combinação ("Avisos e editais", "Proclamas, avisos e editais"). Cada cartão traz o tipo exato publicado.
- **Catálogo de editais com a regra legal.** Cada tipo de edital tem dispositivo legal, número de publicações, intervalo entre elas e prazo (de manifestação, impugnação ou pagamento). Ver a tabela no design. O operador escolhe o tipo dentro do setor; "Outro (sem prazo calculado)" continua disponível.
- **Datas calculadas a partir da 1ª publicação.** O formulário mostra cada publicação, o fim do prazo e preenche a saída do site com esse fim. O operador pode ajustar.
- **Data retroativa.** A data da publicação aceita dia passado, para registrar editais já publicados. O site mostra o edital na etapa em que ele está hoje. Se o prazo já acabou, o formulário avisa que a publicação vai direto para Arquivadas.
- **Republicação automática.** Quando a regra pede mais de uma publicação, o site passa a mostrar "2ª publicação" com a data dela no dia em que ela começa, e a publicação volta ao topo da página inicial. Nada é gravado por tarefa: é calculado na leitura, como a vigência.
- **Anexo na página inicial e em /editais.** Imagem aparece no próprio cartão; PDF tem o link "Abrir o documento (PDF)". A rota do arquivo passa a ser `/publicacoes/[id]/arquivo`, sem exigir a seção `editais` (avisos também têm anexo). O endereço antigo `/editais/[id]/arquivo` continua respondendo.
- **Coluna `notice_type`** em `office_publications` (texto, opcional). Migração aditiva.

## Non-goals

- Feriados municipais e estaduais na contagem. Só os nacionais são conhecidos (`nationalHolidays`); o operador corrige a saída quando o prazo cair num feriado local.
- Publicação em jornal ou no diário oficial. O sistema calcula as datas do site; a publicação na imprensa continua sendo feita pela serventia.
- Regras do Código de Normas da CGJ-RN que ampliem ou detalhem os prazos federais. O catálogo segue a lei federal e o Código Nacional de Normas do CNJ.
- Notificar o operador quando a 2ª publicação começa.
- Gravar o texto ou o anexo da 2ª publicação separado da 1ª: é a mesma publicação, republicada.

## Capabilities

### Modified Capabilities

- `office-publications`: tipo de edital com regra legal, datas calculadas, data retroativa, republicação e anexo visível.
- `public-home`: título da seção e cartões refletem o tipo publicado e mostram o anexo.

## Impact

- `src/core/publications/notice-types.ts` e `notice-schedule.ts` (novos), `expiry.ts`, `publication.ts`.
- Painel: `src/app/admin/(dashboard)/publicacoes`.
- Site: `src/app/(public)/page.tsx`, `editais/page.tsx`, nova rota `publicacoes/[id]/arquivo`.
- Banco: migração `0030_adicionar_tipo_do_edital.sql`. **Produção precisa ser migrada antes do merge.**
