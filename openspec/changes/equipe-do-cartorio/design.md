## Context

Hoje existem três coisas parecidas e separadas:

- a lista "Quem assina" (`settings.signers` dentro de `GuideSettings`, em `tenant_content`): nome, cargo e Portaria/Matrícula, usada nas guias, no ISS, no livro diário, no papel de segurança e nas declarações da agenda;
- os papéis de acesso ao painel (`admin`, `substituto-legal`, `substituto`, `staff`, `auxiliar`, `contador`, `rh`), que dizem o que a conta pode fazer;
- o site público, sem nenhuma página de pessoas.

Os documentos guardam quem assina pela **posição** na lista de quem assina (`guide.signer` é um índice; o ISS e a agenda também). Mudar a ordem ou tirar alguém do meio muda quem aparece em documentos abertos.

Os anexos das publicações são apagados 30 dias depois do envio. Foto e portaria não podem herdar essa regra.

## Goals / Non-Goals

**Goals:**
- O Tabelião cadastra a equipe uma vez e decide, pessoa a pessoa, o que o visitante vê.
- Nada de dado pessoal fica público por descuido: foto exige autorização registrada, portaria exige anexo confirmado.
- "Quem assina" passa a vir da equipe sem mudar quem assina o que já existe.

**Non-Goals:**
- Unificar com as contas do painel.
- Qualquer apagamento no banco.

## Decisions

### 1. Tabela própria, separada das contas

`office_staff` guarda a pessoa, o nível (`level_id`, por id e não por chave estrangeira), a ordem dentro do nível, as marcas (`show_on_site`, `image_consent`, `can_sign`), a ordem em Quem assina (`signer_order`) e os caminhos dos três arquivos. Uma pessoa dos serviços gerais pode nunca ter login. Alternativa descartada: estender a tabela de usuários, que obrigaria uma conta para cada pessoa e misturaria nível de hierarquia com papel de acesso.

### 2. Níveis em `tenant_content`

A lista de níveis (id e nome, em ordem) é pequena e do cartório. Fica na chave `office-team-levels`, como as outras configurações. O id nasce do nome e não muda ao renomear, então a pessoa continua no nível. Um nível usado por alguém, inclusive arquivado, não pode ser retirado: o serviço recusa.

### 3. O que é público é decidido numa função só

`publicPerson` (em `src/core/team/team.ts`) devolve o que o visitante vê ou nada: fora do site se não estiver marcada ou estiver arquivada; foto só com `image_consent`; número, data e arquivo da portaria só com o PDF anexado. A página e as rotas de arquivo usam a mesma regra. Retirar a autorização de imagem tira a foto do ar na hora, porque a rota recusa e o cache é de 5 minutos.

### 4. Anexar a portaria é publicar

O usuário decidiu que a portaria anexada fica aberta a quem entra no site. Por isso o formulário avisa que o arquivo é público (CPF, endereço) e só aceita o anexo com a confirmação marcada. O Word não tem rota pública: só `/admin/configuracoes/equipe/arquivo/<id>/word`, com `team.edit`.

### 5. Arquivos validados pelo conteúdo

Tipo e tamanho são conferidos no servidor pelos primeiros bytes, não pelo nome nem pelo tipo enviado: foto PNG, JPEG ou WebP até 2 MB; portaria PDF até 4 MB; Word `.docx` ou `.doc` até 4 MB. Cada campo aceita só o seu tipo.

### 6. "Quem assina" lê da equipe, com ordem própria e estável

`signer_order` é dado uma vez e nunca reaproveitado; quem deixa de assinar e volta, volta ao mesmo lugar. Enquanto ninguém da equipe tem "Pode assinar", `getGuideSettings` devolve a lista antiga sem tocar nela. Assim que alguém tem, devolve a da equipe, e as telas de edição de Quem assina viram leitura (com o aviso de onde mudar) e a ação antiga recusa gravar. A importação copia a lista antiga na mesma ordem, marca quem já existe pelo nome em vez de duplicar e só roda enquanto ninguém assina na equipe. Alternativa descartada: ordenar quem assina pela hierarquia, que mudaria o índice guardado nos documentos.

### 7. Sem apagar linhas

Arquivar marca `archived_at`. Retirar um arquivo limpa as colunas e apaga o arquivo guardado, a pedido de quem edita (a foto de alguém que pede para sair do site, por exemplo). A migração só cria a tabela e um índice. A limpeza do cartório de demonstração mantém a tabela, e a pasta `equipe/` não está entre as que ela varre.

### 8. Menu só com gente publicada

A seção `equipe` está sempre ligada no cadastro do cartório, mas o link só entra no menu e no rodapé quando há alguém publicado. A página aberta direto, sem ninguém, explica que a equipe ainda não foi publicada.

## Risks / Trade-offs

- **Posição em Quem assina.** Tirar alguém do meio da lista de quem assina ainda desloca os seguintes nos documentos abertos, como já acontecia na lista antiga. A tela de equipe não esconde isso, mas a ordem nunca muda sozinha.
- **Portaria pública com dado pessoal.** O aviso e a confirmação reduzem o risco, mas quem anexa é o responsável. Não há leitura automática do PDF.
- **Foto com autorização frágil entre empregador e empregado.** Por isso o padrão é "não mostrar no site" e a foto exige a marca.
- **Armazenamento público com URL aleatória.** Como nos outros anexos, o arquivo no blob tem endereço aleatório; a rota do site é a que confere o que é público. Retirar o arquivo apaga o blob.
