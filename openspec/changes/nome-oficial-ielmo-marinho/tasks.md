## 1. Configuração do tenant

- [x] 1.1 Em `src/core/tenant/tenants/marinho.ts`, trocar `name: "Cartório Marinho"` por
      `name: "Cartório Ielmo Marinho/RN"`, mantendo `subtitle` como está. Atualizar o comentário
      de contexto do arquivo se ele citar o nome fantasia.
- [x] 1.2 No mesmo arquivo, reescrever `about` para abrir pela denominação oficial ("O Ofício
      Único de Ielmo Marinho / RN reúne todos os serviços de registro e notas do município...")
      sem citar "Cartório Marinho", preservando o restante do parágrafo.

## 2. Adequação ao Provimento

- [x] 2.1 Em `src/core/compliance/sections.ts`, trocar o `help` do campo `tradeName`
      ("ex.: Cartório Marinho") por um exemplo fictício que nenhuma serventia cadastrada usa.

## 3. Testes e documentação

- [x] 3.1 `src/core/request/declaracao.test.ts`: a asserção `/Serventia: Cartório Marinho/` passa
      a casar `/Serventia: Cartório Ielmo Marinho\/RN/`.
- [x] 3.2 `src/core/auth/invite.test.ts`: fixture `tenantName` e as duas asserções passam ao nome
      novo.
- [x] 3.3 `src/core/request/channels.test.ts`: fixture `title: "Atendimento no Cartório Marinho"`
      passa ao nome novo (conferir se alguma asserção casa o título).
- [x] 3.4 `README.md`: as três menções (linhas ~69, ~83 e ~120) passam a "Cartório Ielmo
      Marinho/RN".

## 4. Verificação

- [x] 4.1 Rodar só os testes tocados: `node --test src/core/request/declaracao.test.ts
      src/core/auth/invite.test.ts src/core/request/channels.test.ts`.
- [x] 4.2 `grep -rn "Cartório Marinho" src README.md` volta vazio.
- [x] 4.3 Subir o dev server e conferir em `marinho.localhost:3000`: header e rodapé com o nome
      novo e o subtítulo oficial; `<title>` da home; baixar um requerimento e conferir cabeçalho e
      rodapé do PDF (o selo ainda traz o nome antigo até a serventia trocar a arte, esperado).
- [x] 4.4 Abrir PR a partir de branch própria; não fazer push na main.
