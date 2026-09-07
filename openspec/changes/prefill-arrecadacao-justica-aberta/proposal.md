## Why

A Seção 1 do módulo de adequação pede a receita bruta do último semestre, e é dela que saem a
classe, a subclasse e os prazos das Etapas 1 e 2. Hoje a titular digita esse número de cabeça ou
da contabilidade, sem lastro, num campo que decide quanto tempo a serventia tem e se a nomeação do
encarregado é obrigatória.

A Átrios já tem o número. A base de prospecção (`prospeccao-serventias-rn.xlsx`, extraída da API
pública do Justiça Aberta em 10/07/2026) traz as 218 serventias do RN com receita bruta do semestre
atual e do anterior. As seis serventias atendidas hoje estão todas lá. O próprio brief do módulo já
previa a arrecadação entre os campos pré-preenchidos; ela ficou de fora porque o dado nunca chegou
ao config do tenant.

Duas coisas que os dados revelaram e que o desenho tem de tratar:

- **62 das 218 serventias têm receita zero no semestre atual.** Zero ali não é faturamento nenhum, é
  declaração ainda não enviada (Almino Afonso: zero no atual, R$ 51.142,27 no anterior). Levar esse
  zero para a tela produziria em silêncio "Classe 1, subclasse A" e o prazo mais longo, a partir de
  um dado que não existe.
- **Oito serventias estão a menos de 10% de um teto de classe.** Jucurutu declara R$ 303.767,52 e cai
  na Classe 2 por R$ 3.767. Santo Antônio declara R$ 297.556,06 e fica na Classe 1 por R$ 2.444. Uma
  correção pequena atravessa a fronteira e muda o prazo de 300 para 240 dias.

## What Changes

- O config de cada serventia atendida passa a carregar a receita bruta dos dois semestres, a fonte e
  a **data da extração**. Só as serventias atendidas: a base de prospecção inteira continua fora do
  repositório.
- A Seção 1 vem com os dois valores preenchidos, cada um com a nota de onde veio e quando, e a
  serventia confirma ou corrige. Mesmo mecanismo de `prefillFor` que já preenche nome, CNS, endereço,
  telefone, e-mail e atribuições.
- **Receita zero na origem chega como campo vazio**, com a nota de que o Justiça Aberta não tinha
  declaração para o período. Nunca como o número zero.
- A tela avisa quando o valor informado cai perto de um teto de classe, dizendo qual é a fronteira e
  o que muda de um lado para o outro. Aviso, não bloqueio.
- A classe continua sendo calculada do valor que está no campo, seja ele o pré-preenchido ou o que a
  serventia corrigiu.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `admin-compliance-intake`: a receita bruta da Seção 1 passa a vir pré-preenchida do Justiça Aberta,
  com data e origem visíveis, tratamento de ausência e aviso de fronteira de classe.

## Impact

- `src/core/tenant/schema.ts`: campo `revenue` opcional no `TenantSchema` (dois semestres, fonte,
  data da extração).
- `src/core/tenant/tenants/*.ts`: os seis arquivos das serventias atendidas recebem os valores.
- `src/core/compliance/answers.ts`: `PrefillSource` e `prefillAnswers` passam a levar a receita;
  ausência e zero na origem viram campo vazio.
- `src/lib/compliance.ts`: `prefillFor` repassa o novo campo do tenant.
- `src/core/compliance/classification.ts`: função pura que diz a que distância o valor está do teto
  mais próximo, para o aviso de fronteira.
- `src/app/admin/(dashboard)/adequacao/`: nota de origem e data sob os dois campos, aviso de
  fronteira na Seção 1.
- `openspec/changes/add-compliance-intake`: nada muda ali; esta change entra depois.

## Non-Goals

- **Consultar a API do Justiça Aberta em tempo de execução.** O dado entra como configuração
  revisada em pull request, não como chamada de rede na hora que a titular abre a tela. Um número que
  vira classe, prazo e obrigação num documento assinado não deve depender de um portal de terceiro
  estar de pé, e o caminho manual precisaria existir de qualquer jeito.
- **Commitar a base de prospecção inteira no repositório.** São 218 serventias com nome, telefone e
  e-mail do responsável, e atendemos seis. O dado das outras 212 não tem função na aplicação e não
  entra versionado nela.
- **Atualizar sozinho a cada semestre.** O valor envelhece a cada janeiro e julho; a atualização é
  mudança de config, com a data nova junto.
- **Bloquear o envio por causa da fronteira de classe.** O aviso informa; quem decide o número é a
  serventia, que é quem assina.
- **Rever os cortes de subclasse.** Ver a pergunta em aberto no design: é conferência de texto legal,
  não trabalho desta change.
