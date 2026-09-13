## ADDED Requirements

### Requirement: A verificação do repositório é uma suíte só, em processo
O repositório SHALL ter um único conjunto de testes automatizados, executado por `pnpm test` com
`node --test`, que roda sem browser, sem banco de dados externo, sem rede e sem nenhuma variável
de ambiente secreta. Nenhum script, hook ou passo de CI SHALL depender de Playwright.

#### Scenario: Clone limpo roda a suíte inteira
- **WHEN** alguém clona o repositório, roda `pnpm install` e em seguida `pnpm test`, sem `.env`
  e sem serviço externo no ar
- **THEN** todos os testes rodam e o resultado não depende de nada fora do processo

#### Scenario: Nenhum resquício de e2e
- **WHEN** alguém procura por `e2e/`, `playwright.config.ts` ou pelo script `e2e` no
  `package.json`
- **THEN** nenhum dos três existe, e `pnpm check:a11y` é o único uso restante do Playwright, fora
  de qualquer gate

### Requirement: A costura é testável contra PostgreSQL em memória com as migrações reais
Toda função de `src/lib` que acessa o banco SHALL existir em uma forma que recebe o cliente Drizzle
como argumento (`...With(db, ...)`), de modo que um teste possa passar um cliente
`drizzle-orm/pglite` com os arquivos de `drizzle/*.sql` aplicados na ordem. A forma que usa o
singleton de produção SHALL ser apenas um repasse para a forma injetada.

#### Scenario: Função de costura testada em processo
- **WHEN** um teste cria `drizzle(new PGlite(), { schema })`, aplica as migrações e chama a
  variante `With` de uma função de `src/lib`
- **THEN** a função executa a mesma query que executaria em produção, contra o mesmo schema, e o
  teste afirma o resultado sem mock de Drizzle

#### Scenario: Módulo de `src/lib` carrega fora do Next
- **WHEN** um teste importa um módulo de `src/lib` que usa o alias `@/` e declara
  `import "server-only"`
- **THEN** o módulo carrega sob `pnpm test` sem erro de resolução e sem o lançamento de
  `server-only`

### Requirement: Server actions não contêm regra
Um arquivo `actions.ts` SHALL limitar-se a ler o request (headers, cookies, sessão, tenant),
chamar uma função `With` de `src/lib` e responder (redirecionar, revalidar, devolver estado). Toda
validação de entrada, decisão de estado e montagem de efeito (banco, e-mail) SHALL viver na função
de `src/lib` que a action chama.

#### Scenario: Regra nova em um fluxo
- **WHEN** um change adiciona comportamento a um fluxo que hoje entra por server action
- **THEN** o comportamento é escrito e testado em `src/lib` ou `src/core`, e a action só ganha a
  chamada correspondente

### Requirement: Cobertura de fluxo é teste em processo, por convenção
As tarefas geradas pelo OpenSpec SHALL prescrever teste em processo (`src/core`, `src/db`,
`src/lib`) para cobertura de fluxo, e SHALL NOT prescrever teste Playwright. Essa regra SHALL
constar de `openspec/config.yaml`, e a descrição da stack no mesmo arquivo SHALL NOT listar
Playwright.

#### Scenario: Proposta nova
- **WHEN** alguém roda `/opsx:propose` para um fluxo com banco
- **THEN** o `tasks.md` gerado pede teste em `src/lib` ou `src/db` contra PGlite, e nenhuma
  tarefa cita `e2e/` ou Playwright

### Requirement: Nenhum teste some sem registro
Antes de remover um arquivo de `e2e/`, cada asserção dele SHALL ser classificada como já coberta
em processo, migrada para um teste em processo, ou abandonada de propósito; e o resultado SHALL
constar do `design.md` desta change.

#### Scenario: Spec removido
- **WHEN** um spec de `e2e/` é apagado
- **THEN** o registro da triagem tem uma linha para ele dizendo para onde foi cada regra e o que
  foi abandonado, e o PR que o apaga contém os testes em processo listados nessa linha
