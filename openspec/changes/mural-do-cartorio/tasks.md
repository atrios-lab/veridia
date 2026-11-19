## 1. Antes de começar

- [x] 1.1 Pedido do usuário (19/11/2026): aba como a da equipe para postar casamentos comunitários, eventos sociais e correições
- [x] 1.2 Conferido o CNN compilado: art. 187, parágrafo único (Livro de Visitas e Correições) e art. 105 (correição anual e LGPD); não há regra específica de publicidade

## 2. Regras e banco

- [x] 2.1 `src/core/news/news.ts`: tipos, formulário, o que o visitante vê, ordem e validação de arquivo pelo conteúdo, com testes
- [x] 2.2 Tabelas `office_news` e `office_news_files` e migração só de criação; tabelas mantidas na limpeza do cartório de demonstração
- [x] 2.3 Serviço `src/lib/news.ts` com testes no banco de teste: criar, publicar, arquivos, limite de fotos, troca do PDF, arquivar e voltar, o que o site mostra
- [x] 2.4 Permissão `news.edit` (derivada de `user.manage`, fechada ao participante da demonstração), rótulos de auditoria e gravidade

## 3. Painel

- [x] 3.1 Configurações › Notícias e eventos: lista, formulário, fotos, PDF, arquivar e voltar
- [x] 3.2 Rota do painel que serve foto e PDF a quem edita
- [x] 3.3 Ajuda da tela
- [x] 3.4 Botão "Qualificar o título deste pedido" pisca suavemente enquanto não há qualificação

## 4. Site

- [x] 4.1 Seção `noticias`, página `/noticias` com filtro por tipo e página de cada notícia
- [x] 4.2 Rota pública de arquivo, só de notícia publicada, foto só com autorização
- [x] 4.3 Link no menu Cidadão e no rodapé só com notícia publicada

## 5. Entrega

- [x] 5.1 Bateria completa, PR e merge
