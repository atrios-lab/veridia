## Why

O Provimento CN 243/2026 (que reescreve o 213/2026) obriga cada serventia a montar a documentação
de segurança da informação e continuidade dentro de um prazo contado da vigência: 300, 240 ou 180
dias conforme a classe. A Átrios gera esses documentos para as serventias clientes com um gerador
que roda fora do painel e lê um JSON por serventia (`bom-jesus.json`, `ielmo-marinho.json`). Hoje
esse JSON é montado à mão, a partir de perguntas feitas por WhatsApp em várias rodadas: a titular
responde pela metade, esquece o que já mandou, e a Átrios reescreve o arquivo a cada correção.

## What Changes

- Novo módulo **"Adequação ao Provimento"** no painel da serventia, no grupo "Serventia" do menu:
  17 seções curtas, uma por tela, em linguagem de fato ("Os computadores pedem um segundo código
  além da senha?"), cada campo com ajuda "?" e opção "não sei" onde faz sentido.
- **Cada campo salva ao sair dele**, sem botão Salvar. A titular responde a Seção 7 hoje e a 10 na
  semana que vem, pelo celular ou pelo computador.
- **Pré-preenchimento** do que o painel já sabe: dados da serventia (Configurações), titular,
  encarregado (aba Encarregado), atribuições. Essas seções aparecem como "não iniciada" até a
  serventia abrir e confirmar.
- **Perguntas condicionais**: sem gerador não se pergunta autonomia; sem servidor não se pergunta
  o Windows dele; a nomeação do encarregado só é opcional na Classe 1.
- **Classe, subclasse e prazos** calculados na hora pela receita bruta semestral (art. 16 e 20 do
  Provimento 243) e mostrados na tela inicial.
- **Avisos na hora da resposta** para o que vira pendência de 30 dias nos documentos (Windows 10,
  Office 2013, sem antivírus, sem backup, sem nobreak, sem segundo fator, nuvem sem cifra na
  origem, backup nunca restaurado) e contagem de avisos por seção na lista.
- **Tela de revisão** com tudo agrupado por seção, botão "Editar" em cada uma, declaração de
  veracidade e botão "Enviar para a Átrios". O envio grava data e versão, manda e-mail de
  confirmação à serventia e aviso à Átrios, e a coleta continua editável.
- **Perfil Átrios** (a conta `superadmin`, dentro do painel da serventia) vê, além do que a serventia
  vê: a lista de pendências detectadas, os "não sei" a confirmar, as seções alteradas depois do
  envio e o botão **Exportar JSON**, que baixa o arquivo no formato do gerador.
- **Cartão na Visão geral**: "N de 17 seções respondidas" com botão de continuar; depois do envio,
  "Informações enviadas à Átrios em [data]".
- Seção 17 aceita **anexos** (fotos de etiqueta, contratos, print do Windows, cartão CNPJ, logo)
  pelo mesmo armazenamento e limites dos demais anexos do painel.

## Capabilities

### New Capabilities

- `admin-compliance-intake`: a coleta das informações da adequação ao Provimento 243 no painel,
  do pré-preenchimento ao envio e à exportação do JSON pelo perfil Átrios.

### Modified Capabilities

- `admin-shell`: item "Adequação ao Provimento" no grupo "Serventia" do menu, oferecido a quem tem
  `content.edit`.
- `admin-overview`: cartão de progresso da coleta na coluna direita da Visão geral.

## Impact

- `src/core/compliance/`: as 17 seções como dados (`sections.ts`), respostas efetivas, status e
  progresso (`answers.ts`), classe e prazos (`classification.ts`), regras de derivação
  (`pendencies.ts`) e o JSON do gerador (`export.ts`). Puro, testado em `compliance.test.ts`.
- `src/db/schema.ts` e `drizzle/0019_kind_bloodaxe.sql`: tabela `compliance_intakes`, uma linha
  por serventia, com respostas e data por seção em JSONB, anexos, data e versão do envio.
- `src/lib/compliance.ts`: leitura, gravação por campo (merge JSONB no banco, sem ler antes),
  marcação de seção visitada, envio e anexos, com auditoria.
- `src/lib/email/compliance.ts`: os dois e-mails do envio.
- `src/app/admin/(dashboard)/adequacao/`: lista, seção, revisão, rotas de exportação e de anexo.
- `src/app/admin/(dashboard)/_components/compliance-card.tsx` e `page.tsx`: cartão da Visão geral.
- `src/app/admin/_components/nav.ts` e `icon.tsx`: item e ícone do menu.
- `e2e/admin-compliance.spec.ts`: resposta salva e avisa, sobrevive a sair e voltar, exportar
  invisível para a serventia.

## Non-Goals

- Gerar documento, publicar PDF, anexar o assinado, registrar o protocolo do Justiça Aberta ou
  controlar a renovação anual. A estrutura (versão e data do envio) fica pronta; nada disso é
  construído.
- Enviar qualquer coisa ao sistema da Átrios: o JSON é baixado pelo perfil Átrios dentro do painel.
- Validar respostas contra a norma além das regras de derivação listadas. O módulo detecta e
  avisa; quem aplica no documento é o gerador.
- Bloquear a edição depois do envio. A coleta continua aberta e a alteração fica marcada.
- Atualizar sozinho a tabela do art. 16 quando a Corregedoria divulgar novos limites: são duas
  constantes em `classification.ts`, trocadas por mudança de código.
- Upload direto do navegador para o Blob (o caminho `anexosRef`): o anexo da Seção 17 passa pela
  server action, como o edital em Publicações.
