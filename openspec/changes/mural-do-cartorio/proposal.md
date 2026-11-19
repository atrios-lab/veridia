## Why

O cartório não tem onde contar o que acontece fora do balcão. Os casamentos comunitários, os eventos com a comunidade e as visitas de correição ficam em redes sociais e em grupos de mensagem, longe de quem procura o cartório no site. As publicações já existentes (proclamas, avisos e editais) são atos formais, com data de entrada e de saída, e não servem para uma notícia que deve ficar no ar.

Uma aba "Notícias e eventos" no painel, no mesmo desenho da Equipe do cartório, que alimenta uma página "Notícias e eventos" no site, dá ao cartório um mural próprio e deixa o Tabelião no controle do que é público.

## What Changes

- **Notícias e eventos (painel).** Nova tela em Configurações, aberta só ao Tabelião por padrão (permissão nova `news.edit`, que ele concede em Perfis e permissões). Cada notícia tem título, tipo (Casamento comunitário, Evento social, Correição, Outras notícias), data do evento, resumo, texto, até 8 fotos e um PDF. A tela lista as notícias, edita, arquiva e volta.
- **Notícias e eventos (site).** Página `/noticias` com cartões, filtro por tipo e a página de cada notícia com o texto, as fotos e o PDF. O link entra no menu "Cidadão" e no rodapé só depois que houver uma notícia publicada.
- **O que o visitante vê:**
  - só o que estiver marcado em "Mostrar no site";
  - as fotos só com a autorização de imagem das pessoas registrada;
  - o PDF quando anexado: anexar é publicar, e o painel pede a confirmação de que o arquivo pode ser público.
- **Correição.** O Livro de Visitas e Correições é escriturado pela autoridade judiciária (CNN, art. 187, parágrafo único). O painel avisa que a notícia só informa que a visita aconteceu, sem dados pessoais nem o conteúdo da ata.
- **Botão que pisca.** Em cada pedido, o botão "Qualificar o título deste pedido" pisca suavemente enquanto ninguém qualificou o título, para o funcionário ver.
- **Nada se apaga.** Uma notícia sai das listas por arquivamento. Retirar um arquivo só marca a linha como retirada. A migração só cria duas tabelas.

## Non-goals

- Substituir as publicações formais (proclamas, avisos e editais).
- Comentários, curtidas ou envio de notícias pelo cidadão.
- Agendar a publicação por data: a notícia aparece quando é marcada.
- Redes sociais: não há integração nem republicação automática.

## Capabilities

### New Capabilities

- `office-news`: o mural do cartório, o que o site mostra e como as fotos e o PDF são protegidos.

### Modified Capabilities

(nenhuma)

## Impact

- Banco (só acrescenta): tabelas `office_news` e `office_news_files`.
- Nova seção pública `noticias`, sempre ligada, que só aparece no menu com notícia publicada.
- Permissão `news.edit`, rótulos de auditoria e gravidade (anexar PDF é "atenção").
- Os arquivos ficam em `noticias/<cartório>/`, fora da limpeza do cartório de demonstração.
