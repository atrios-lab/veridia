## Why

O Registro Civil já tem no painel a pesquisa, a ficha e as certidões de nascimento, casamento e
óbito (change `consulta-de-registro-rcpn`). O que ainda obriga a serventia a abrir o sistema antigo
todo dia é o **processo de habilitação para o casamento**: dele saem a declaração dos nubentes, a
declaração das testemunhas, o edital de proclamas, a certidão de que o edital correu sem
impedimento, o certificado de habilitação e, depois da celebração, o termo do Livro B e as
comunicações.

O dono do projeto mandou os modelos do sistema atual (14/11/2026, mais de cem arquivos `.rtf` de
habilitação, livro de casamento, editais, declarações e comunicações) e pediu: "analise tudo e faça
melhor, mais fácil e mais elegante", sem copiar os textos (plágio) e conferindo sempre a Lei de
Registros Públicos, o Código Civil e o Código Nacional de Normas.

A análise dos modelos (só estrutura; nenhum dado de cliente copiado) mostrou:

- **um modelo por variação**: há declaração dos contraentes para noivo analfabeto, noiva
  analfabeta, os dois analfabetos, procurador do noivo, procurador da noiva, divorciado ou viúvo,
  separação obrigatória, conversão de união estável... e livro de casamento para solteiros,
  divorciados, pacto antenupcial, residência, religioso. A serventia escolhe o arquivo certo à mão,
  e cada um repete os mesmos dados;
- **o edital de proclamas traz mais do que a norma permite**: profissão, idade, data de
  nascimento, endereço completo. O Código Nacional de Normas (Provimento CNJ nº 149/2023, art. 122)
  manda que o edital contenha **tão somente** o nome, o estado civil, a filiação, a cidade e a
  circunscrição do domicílio dos noivos;
- **"ELE" e "ELA"** e "noivo"/"noiva" fixos: não atende o casamento entre pessoas do mesmo sexo
  (Resolução CNJ nº 175/2013; CNN, art. 554);
- **prazos à mão**: desde a Lei nº 14.382/2022, a publicidade da habilitação é eletrônica e o
  certificado sai em até 5 dias (Lei 6.015/1973, art. 67, § 1º); a eficácia é de 90 dias a contar
  do certificado (Código Civil, art. 1.532). Nada no sistema atual avisa o vencimento.

## What Changes

- **Registro Civil › Habilitação de casamento (área nova)**: um processo por casal, com número
  anual, preenchido **uma vez**. Cada documento sai desses dados, e a variação (analfabeto,
  procurador, divorciado, viúvo, menor com autorização, pacto, separação obrigatória, conversão de
  união estável, casamento religioso com efeito civil, casamento em outra serventia) é uma escolha
  na ficha, não um arquivo diferente.
- **Nubentes neutros**: "1º nubente" e "2º nubente", com o gênero só onde a pessoa o declara.
- **Documentos gerados em PDF**, com texto próprio, escrito a partir da lei:
  - requerimento e declaração dos nubentes (CC, art. 1.525; LRP, art. 67);
  - declaração de duas testemunhas (CC, art. 1.525, III);
  - edital de proclamas no conteúdo do CNN, art. 122 (com a menção de conversão de união estável
    quando for o caso, LRP, art. 70-A, § 1º);
  - certidão de publicação do edital e de inexistência de impedimento;
  - certificado de habilitação, com a data em que vence (CC, arts. 1.531 e 1.532; LRP, arts. 67,
    § 1º, e 71).
- **Publicar o edital no site** com um clique, pela área de publicações que já existe (tipo
  proclamas), já no conteúdo permitido.
- **Prazos visíveis**: prazo do certificado (até 5 dias da publicação) e vencimento da habilitação
  (90 dias), com destaque quando estiverem perto.
- **Tudo editável, alterar e excluir com justificativa** (exclusão sem apagar: marcada, com quem,
  quando e por quê), com histórico e auditoria, como na ficha do registro.
- **Permissão própria** em Perfis e permissões: "Registro Civil: habilitação de casamento".

## Non-goals (próximas etapas)

- Termo do Livro B a partir da habilitação, comunicações dos arts. 106 e 107 da LRP e envio à
  CRC: etapa seguinte, sobre os mesmos dados.
- Livro E (emancipação, interdição, ausência), transcrições e certidões do Livro E.
- Envio de selo e integração com a CRC/ON-RCPN.

## Capabilities

### New Capabilities
- `rcpn-habilitacao`: processo de habilitação para o casamento no painel, com documentos, edital
  no site e prazos.

## Impact

- Banco: tabelas novas (migração só aditiva).
- Painel: telas novas em Registro Civil; permissão nova; ajuda "!".
- Site: o edital entra pelas publicações existentes.
