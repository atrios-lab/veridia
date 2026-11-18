## 1. Antes de começar

- [x] 1.1 Hierarquia na ordem do Tabelião, sem "escrevente substituto" (usuário, 18/11/2026)
- [x] 1.2 No site aparece só quem for marcado (usuário, 18/11/2026)
- [x] 1.3 A portaria anexada fica pública; sem anexo, só nome, cargo e profissão; o Word fica só no painel (usuário, 18/11/2026)
- [x] 1.4 Níveis editáveis e reordenáveis (usuário, 18/11/2026)
- [x] 1.5 Lista única com Quem assina (usuário, 18/11/2026: "pode ser quem assina, veja a melhor forma")
- [x] 1.6 Só o Tabelião edita por padrão, com liberação em Perfis e permissões (usuário, 18/11/2026)

## 2. Regras e banco

- [x] 2.1 `src/core/team/team.ts`: níveis, o que o visitante vê, agrupamento, quem assina, validação de arquivo pelo conteúdo, com testes
- [x] 2.2 Tabela `office_staff` e migração só de criação; tabela mantida na limpeza do cartório de demonstração
- [x] 2.3 Serviço `src/lib/team.ts` com testes no banco de teste: níveis, pessoas, arquivos, ordem, arquivar e voltar, o que o site mostra, Quem assina
- [x] 2.4 Permissão `team.edit` (derivada de `user.manage`, fechada ao participante da demonstração), rótulos de auditoria e gravidade

## 3. Painel

- [x] 3.1 Configurações › Equipe do cartório: lista por nível, formulário, arquivos, subir e descer, arquivar, níveis, importar Quem assina
- [x] 3.2 Rota do painel que serve foto, portaria e Word a quem edita
- [x] 3.3 Ajuda da tela e aba em Configurações

## 4. Site

- [x] 4.1 Seção `equipe` (rótulo, rota, descrição, SEO), página `/equipe` e menu só com gente publicada
- [x] 4.2 Rotas públicas da foto e da portaria que conferem o que é público

## 5. Quem assina

- [x] 5.1 `getGuideSettings` lê da equipe quando alguém está marcado; telas de Quem assina e do ISS viram leitura; a ação antiga recusa gravar
- [x] 5.2 Importação na mesma ordem, sem duplicar quem já existe

## 6. Verificação

- [x] 6.1 Bateria do CI e `pnpm build`
- [x] 6.2 Conferido no navegador, com cartório e pessoas fictícios: cadastro com arquivos, site, rotas de arquivo e retirada
