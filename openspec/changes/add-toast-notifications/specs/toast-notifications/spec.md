## ADDED Requirements

### Requirement: Provider único de toast no painel

O painel administrativo SHALL montar um único provider de toast no layout raiz do admin
(`src/app/admin/layout.tsx`), disponível a qualquer tela do admin — incluindo `login`, fora do
grupo `(dashboard)` — sem exigir configuração própria por tela. Sem nenhum toast ativo, o provider
SHALL não renderizar nenhum elemento visível.

#### Scenario: Provider disponível em qualquer tela do admin

- **WHEN** uma tela do admin dispara um toast de sucesso ou erro
- **THEN** o toast aparece na tela, sem a tela precisar montar seu próprio provider

#### Scenario: Sem toast ativo, nada aparece

- **WHEN** nenhuma tela disparou um toast
- **THEN** o provider não altera o layout visível da página

### Requirement: Aparência do toast segue o estilo publicado da serventia

O toast de sucesso e o toast de erro SHALL usar os mesmos tokens de cor `admin-*` já usados pelos
banners de sucesso e erro existentes (`admin-success-bg`/`admin-success-text` para sucesso,
`admin-error-bg`/`admin-error-text` para erro), nunca cor fixa fora de `@theme`. Como esses tokens
já variam por estilo publicado da serventia, o toast SHALL parecer coerente com o mesmo estilo em
qualquer um dos cinco disponíveis, sem configuração adicional por tenant.

#### Scenario: Toast de sucesso em dois estilos diferentes

- **WHEN** duas serventias com estilos publicados diferentes disparam o mesmo toast de sucesso
- **THEN** cada uma vê o toast nas cores do próprio estilo, não numa cor fixa alheia ao tema

### Requirement: Escopo do toast é confirmação transitória, não erro bloqueante

Um toast SHALL ser usado apenas para feedback transitório que não precisa permanecer na tela para
o usuário agir (ex.: confirmação de que uma gravação foi aceita). Erros de validação por campo e
banners que bloqueiam o formulário até o usuário corrigir SHALL continuar como elemento fixo na
tela, não como toast, porque um toast pode ser dispensado ou expirar antes do usuário terminar de
ler ou corrigir.

#### Scenario: Confirmação de gravação usa toast

- **WHEN** uma gravação é aceita e não exige nenhuma ação adicional do usuário
- **THEN** a confirmação aparece como toast, e não como banner fixo na tela

#### Scenario: Erro de campo continua fixo

- **WHEN** um campo do formulário falha na validação
- **THEN** a mensagem de erro permanece fixa junto ao campo até o usuário corrigir, e não é um
  toast que pode desaparecer sozinho

### Requirement: Toast não substitui fluxo que termina em navegação de página inteira

Uma tela cuja ação termina em redirecionamento de documento inteiro SHALL continuar confirmando o
resultado pelo conteúdo da página carregada após o redirect — o padrão de banner já usado hoje —,
não por um toast disparado antes de navegar, que seria descartado junto com a página que o
disparou, antes de o usuário conseguir vê-lo.

#### Scenario: Ação com redirect não depende de toast para confirmar

- **WHEN** uma ação bem-sucedida redireciona para outra página
- **THEN** a confirmação chega ao usuário pelo conteúdo da página carregada após o redirect, não
  por um toast disparado antes de navegar
