## Why

O cartório não tem onde mostrar quem atende. O cliente que chega ao site vê os serviços, mas não sabe quem é o Tabelião, quem responde pelo expediente nas ausências e quem pode praticar cada ato. A hierarquia da serventia (Tabelião, substitutos, escreventes autorizados, escreventes, auxiliares, serviços gerais) fica em portarias e em arquivos soltos do Word. A lista de quem assina as guias, o ISS e as declarações já guarda nome, cargo e Portaria/Matrícula, mas só para uso interno e sem foto.

Uma aba "Equipe do cartório" no painel, que alimenta uma página "Nossa equipe" no site, junta os dois usos e dá ao Tabelião o controle do que é público.

## What Changes

- **Equipe do cartório (painel).** Nova tela em Configurações, aberta só ao Tabelião por padrão (permissão nova `team.edit`, que ele concede em Perfis e permissões). Cada pessoa tem nome, cargo (nível da hierarquia), profissão, Portaria/Matrícula, data da portaria, foto, portaria em PDF e Word da portaria. A tela lista as pessoas por nível, deixa subir e descer dentro do nível, arquivar e voltar.
- **Níveis editáveis.** Vêm prontos na ordem do Tabelião (Tabelião e Registrador, Substituto legal, Substituto, Escrevente autorizado, Escrevente, Auxiliar de cartório, Serviços gerais). O cartório renomeia, reordena e cria os seus. Um nível com pessoas, mesmo arquivadas, não sai.
- **Nossa equipe (site).** Página `/equipe` com o mosaico por nível, do Tabelião para baixo, dentro do tema do cartório. O link entra no menu "Cidadão" e no rodapé só depois que houver alguém publicado.
- **O que o visitante vê** (decisão do usuário em 18/11/2026):
  - só quem estiver marcado em "Mostrar no site", com nome, cargo e profissão;
  - a foto só com a autorização de imagem registrada;
  - a portaria (número, data e o PDF para abrir) só quando o PDF é anexado: anexar é publicar, e o painel pede a confirmação de que o arquivo pode ser público;
  - o Word da portaria fica só no painel e nunca é servido ao site.
- **Lista única com "Quem assina".** Cada pessoa tem "Pode assinar documentos". Quem estiver marcado forma a lista de quem assina as guias, o ISS e as declarações, na ordem em que entrou, que não é a da hierarquia: os documentos guardam quem assina pela posição nessa lista. Um botão "Trazer quem assina para a equipe" copia a lista de hoje, na mesma ordem. Enquanto ninguém da equipe assina, nada muda na tela Quem assina.
- **Nada se apaga.** Uma pessoa sai das listas por arquivamento. A migração só cria uma tabela. Retirar a foto, a portaria ou o Word limpa as colunas e apaga o arquivo guardado, a pedido de quem edita.

## Non-goals

- Ligar a pessoa da equipe a uma conta de acesso ao painel. Quem trabalha no balcão pode não ter login, e o nível da hierarquia não é o papel de acesso.
- Arrastar e soltar. A ordem muda por botões de subir e descer.
- Ler o Word para preencher a lista. O Word é um anexo interno.
- Mostrar a equipe a quem está logado no painel fora da tela de edição.
- Validar a nomenclatura dos cargos contra a norma de cada Corregedoria. Os níveis são do cartório.

## Capabilities

### New Capabilities

- `office-team`: o cadastro da equipe do cartório, o que o site mostra e a ligação com a lista de quem assina.

### Modified Capabilities

(nenhuma)

## Impact

- Banco (só acrescenta): tabela `office_staff`. Os níveis ficam em `tenant_content`.
- Permissão nova `team.edit`, derivada de `user.manage`, e fechada para o participante do cartório de demonstração.
- Seção nova `equipe` no site (sempre ligada), com rótulo, rota, descrição e SEO.
- `getGuideSettings` passa a ler quem assina da equipe quando ela tem alguém marcado.
- Arquivos em `equipe/<cartório>/` no armazenamento, servidos por rotas que conferem o que é público.
