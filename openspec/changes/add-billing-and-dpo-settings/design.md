## Context

O painel já tem duas abas de Configurações funcionando (Serventia e Identidade Visual) e as duas
usam o mesmo caminho: um pick do `TenantSchema` em `src/core/tenant/overrides.ts`, uma linha em
`tenant_content` gravada direto em `published`, e `applyTenantOverrides` deitando o override sobre
a configuração em código na leitura de `getTenant`. As abas Encarregado e Cobrança seguem esse
caminho — não inventam outro.

A diferença entre as duas: o DPO já existe no `TenantSchema` (`dpo: { name, email }`) e já é
publicado na página LGPD e no rodapé do PDF do requerimento; só não é editável. A chave Pix não
existe em canto nenhum — é dado novo, e é o dado mais sensível que o painel vai guardar.

Restrições que valem aqui: regra em núcleo puro (`src/core/`), sem I/O; esconder botão não é
controle de acesso; nenhuma migração destrutiva; texto visível em português, código em inglês.

## Goals / Non-Goals

**Goals**

- Serventia corrige nome e e-mail do Encarregado sozinha, e a correção chega ao site na hora.
- Serventia cadastra, corrige e remove a própria chave Pix, com o formato conferido no servidor.
- Chave Pix separada por permissão: operador lê, quem responde pela serventia grava.
- Zero migração de banco.

**Non-Goals** (o detalhe está na proposta)

- Nada de payload Pix / QR Code / copia-e-cola, nada de conciliação, nada de webhook de PSP.
- Nada de conferir titularidade da conta.
- Usuários e Trocar senha não entram.

## Decisions

### 1. Uma chave de `tenant_content` por aba, não um blob de configurações

`office-dpo` e `office-pix`, ao lado de `office-contact` e `office-brand`.

*Alternativa considerada*: acrescentar `dpo` ao pick de `OfficeContactSchema` e gravar tudo numa
chave só. Recusada: a gravação escreve o objeto parseado inteiro, então salvar a aba Serventia sem
`dpo` no formulário apagaria o Encarregado. Chaves separadas fazem cada formulário dono do que
grava, e um blob corrompido derruba só a própria aba.

Custo: `readTenantOverrides` passa a buscar quatro chaves em vez de duas — mesma consulta, mesmo
`inArray`, nenhuma consulta a mais.

### 2. `applyTenantOverrides` passa a receber um registro, não mais parâmetros posicionais

Hoje é `applyTenantOverrides(tenant, contactRaw, brandRaw)`. Com quatro overrides, posicional vira
armadilha (trocar dois argumentos `unknown` de lugar compila). Vira
`applyTenantOverrides(tenant, { contact, brand, dpo, pix })`, com a mesma disciplina de sempre:
cada bloco parseado por conta própria, `safeParse` que falha é ignorado, override quebrado nunca
derruba o site. Um único chamador (`src/lib/tenant.ts`) e os testes.

### 3. `pix` entra no `TenantSchema` como campo opcional

A chave é dado da serventia como qualquer outro, e ficar no `TenantSchema` é o que permite reusar
o pick, o override e o merge sem estrutura nova. Opcional porque hoje nenhuma serventia tem chave
— e "sem chave" é um estado legítimo e permanente, não um estado de transição.

```
pix: z.object({ type: PixKeyTypeSchema, key: z.string().min(1) }).optional()
```

*Alternativa considerada*: tabela própria `tenant_billing`. Recusada por ora: um par
tipo/valor não justifica migração, e o dia que a cobrança tiver mais que isso (conta bancária,
PSP, histórico) a tabela nasce com o que ela precisa, não com um resto deste par.

### 4. A validação da chave é uma função pura por tipo, em `src/core/tenant/pix.ts`

Cinco tipos: `cpf`, `cnpj`, `email`, `phone`, `random`. Cada um tem uma forma conferível, e a
validação é feita no `superRefine` do schema, com a mensagem apontando para o campo `key`:

| tipo     | regra                                                        |
|----------|--------------------------------------------------------------|
| `cpf`    | 11 dígitos, dígitos verificadores conferem                    |
| `cnpj`   | 14 dígitos, dígitos verificadores conferem                    |
| `email`  | `z.email()`                                                   |
| `phone`  | `+55` seguido de DDD e 8 ou 9 dígitos                         |
| `random` | UUID v4, o formato que o Banco Central emite (EVP)            |

`isValidCpf` e `normalizeCpf` já existem em `src/core/request/form.ts` e são reusados; a de CNPJ
não existe e nasce aqui, no mesmo módulo puro, com o mesmo mod-11 do CPF sobre os pesos do CNPJ.

**A chave é normalizada antes de gravar** — dígitos para CPF/CNPJ, `+55` + dígitos para telefone,
minúsculas para e-mail e para o UUID. O que se guarda é o que um dia vira payload; a máscara é
coisa de tela. A tela mostra formatado, o banco guarda normalizado.

*Alternativa considerada*: aceitar qualquer string e deixar o PSP recusar. Recusada: não há PSP
nesta mudança, então o erro só apareceria no extrato que não fecha, semanas depois.

### 5. Permissão nova `billing.edit`, só para `admin`

`content.edit` já é do `staff`, e a chave que recebe o dinheiro não é edição de conteúdo. A rota
`/admin/configuracoes/cobranca` exige `content.edit` para **abrir** (o operador precisa conferir
qual chave está no ar) e `billing.edit` para **gravar ou remover**. Sem `billing.edit` a tela
renderiza o bloco em leitura, sem botão — e a action recusa no servidor de qualquer jeito. Esconder
o botão é cortesia; a action é o portão.

`/admin/configuracoes/encarregado` fica em `content.edit`: o contato do DPO é publicação
institucional, do mesmo naipe do telefone da serventia.

### 6. Remover a chave é ação própria, não campo vazio

"Remover chave" apaga a linha `office-pix` e volta ao estado "sem chave" — que a tela nomeia e
explica ("sem chave, a consulta de protocolo não mostra QR Code"). Um formulário que aceita campo
vazio como remoção confunde erro de digitação com decisão.

### 7. Gravação vai direto para `published`

Mesma razão das outras duas abas: contato de Encarregado e chave de recebimento são operacionais,
não editoriais. A serventia que corrige precisa da correção no ar agora, não depois que alguém
lembrar de publicar. `revalidatePath("/", "layout")` depois de gravar o DPO, porque ele aparece na
página LGPD.

## Risks / Trade-offs

- **Chave Pix digitada errada manda dinheiro do cidadão para a conta de outra pessoa, e o formato
  válido não impede isso** → mitigação parcial e declarada em tela: o texto diz que o sistema
  confere o formato mas não tem como saber se a conta é da serventia. Permissão restrita a
  `admin`, e toda gravação e remoção deixa linha em `audit_log` com autor e data. Conferência de
  titularidade só existe com PSP, que não está nesta mudança.
- **Guardar a chave sem nunca gerar payload pode virar dado parado** → aceito: é o pré-requisito
  da mudança que trouxer o valor devido, e a aba Cobrança tem valor por si (a registradora
  consulta e corrige o que está cadastrado).
- **`applyTenantOverrides` muda de assinatura** → um chamador só, coberto por
  `src/core/tenant/overrides.test.ts`; quebra em compilação, não em produção.
- **Serventia sem DPO cadastrado publica página LGPD sem contato, o que a lei exige** → o estado
  não é alcançável hoje: `dpo` é obrigatório no `TenantSchema` e toda serventia tem o seu em
  config. O override só substitui, nunca esvazia — nome e e-mail são obrigatórios no formulário.
  O aviso "sem encarregado cadastrado" do design fica no painel como estado defensivo da tela.

## Migration Plan

Nenhuma migração de banco: as quatro chaves vivem em `tenant_content`, que já existe com o índice
único `(tenant_slug, key)`.

Deploy único. Rollback é reverter o código: as linhas `office-dpo` e `office-pix` que ficarem no
banco viram overrides que ninguém lê, e a leitura volta a servir a configuração em código. Nada a
desfazer.

## Open Questions

- O tipo `phone` guarda `+5584999998888`. Se um dia o payload EMV for gerado, confirmar que é essa
  a forma que o Banco Central espera (é, na especificação atual) antes de escrever o QR.
- A tela mostra a chave inteira para quem tem `content.edit`. Se a serventia pedir mascaramento
  parcial para o operador, é ajuste de tela, não de modelo.
