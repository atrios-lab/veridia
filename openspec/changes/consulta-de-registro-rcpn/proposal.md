## Why

Boa parte do que chega ao balcão do Registro Civil é a mesma pergunta: "o meu registro é
daqui?" e, dos advogados, "qual profissão consta no registro?" (para pedir aposentadoria
rural, por exemplo). Hoje a resposta passa pelo ato `rcpn-busca`: a serventia procura nos
livros e responde pelo protocolo. É trabalho manual repetido para uma pergunta que os dados
do próprio sistema do registro civil (Cartosoft) já respondem.

O dono do projeto decidiu (13 e 14/11/2026):

- o site da serventia ganha uma consulta "Seu registro é daqui?", por nome completo, nome da
  mãe e data de nascimento, gratuita;
- a resposta mostra a profissão declarada no registro, quando houver, porque é o que os
  advogados precisam, e assim o cartório não perde tempo procurando;
- o painel ganha uma área própria do RCPN, onde a serventia envia os arquivos exportados do
  sistema do registro civil, em **qualquer formato**, para alimentar a consulta.

A análise do banco do Cartosoft enviado pela serventia (Access `.mdb`, fevereiro de 2016)
mostrou o que os dados permitem e o que não permitem, e isso molda a proposta:

- a busca por nome, mãe e nascimento é viável: os três campos estão preenchidos em quase
  100% dos nascimentos, e a matrícula CNJ em 100% dos registros;
- a profissão está pouco preenchida no nascimento (cerca de 11% do pai e 12% da mãe), bem mais
  no casamento (cerca de 60%) e quase sempre no óbito;
- as anotações de casamento e óbito não estão de forma confiável no banco: o campo de
  anotações traz, na prática, as testemunhas;
- o banco traz dados que a consulta não usa e que não devem ir para a nuvem (CPF, documentos,
  causa da morte, usuários e senhas do sistema).

## What Changes

- **Painel › RCPN (área nova).**
  - **Importar arquivos:** aceita qualquer arquivo, de qualquer extensão, sem recusar
    nenhum. Guarda o original como veio, abre pacotes (`.zip`, `.rar`, `.7z`...) e reconhece
    o formato pelo conteúdo.
  - **Ler o que for possível:** bancos (Access, dBase, SQLite, cópia `.sql`), planilhas, texto
    separado ou em colunas fixas, XML e JSON. O que não for possível ler fica guardado, com
    aviso e orientação para exportar em formato aberto.
  - **Ligar colunas aos campos:** o Cartosoft já vem ligado. Para outro sistema, uma pessoa
    liga as colunas uma vez na tela, e a ligação fica salva como modelo.
  - **Conferência antes de publicar:** o sistema mostra o que leu, com contagens e problemas,
    e uma pessoa publica no índice. Reimportar não duplica: a chave é a matrícula CNJ.
  - **Minimização (LGPD):** a leitura extrai só os campos do índice e descarta o resto.
  - **Pesquisa interna:** o balcão pesquisa o índice com tolerância a grafia e responde a
    busca na hora.
  - **Imagens das folhas (TIFF, JPG, PDF escaneado):** ficam guardadas e ligadas ao registro,
    só no painel.
- **Site › "Seu registro é daqui?" (consulta pública, gratuita).**
  - Quem consulta informa o nome completo, o nome da mãe e a data de nascimento do registro.
  - Também informa os próprios dados (nome, CPF, OAB se for advogado) e a finalidade, e
    declara usar a informação só para essa finalidade.
  - **Localizado:** o site diz que o registro é desta serventia e mostra a profissão
    declarada, dizendo de quem é (pai, mãe, cônjuge, falecido), quando houver. Mostra também
    casamento ou óbito encontrados no índice, só o que for encontrado. Junto, o aviso de que a
    informação é para orientação e não tem valor de certidão, e os botões para pedir a
    certidão ou o inteiro teor, já preenchidos com o registro.
  - **Profissão não está nos dados digitais:** o site diz exatamente isso e oferece a busca,
    para o cartório conferir no livro.
  - **Não localizado:** o site diz que isso não quer dizer que o registro não exista aqui (o
    índice pode estar incompleto) e oferece o pedido de busca (`rcpn-busca`).
  - **Proteção:** só correspondência exata (sem sugestão de nomes parecidos), limite de
    tentativas e auditoria de toda consulta.
- **Perfis e permissões:** duas permissões novas, "RCPN: pesquisar" e "RCPN: importar
  arquivos".
- **Fora desta mudança:** emissão da certidão pelo portal, com selo do TJRN e assinatura
  digital. O índice já guarda o que ela vai precisar (matrícula, livro, folha, termo), mas a
  emissão depende de conferir na norma se a certidão eletrônica do RCPN pode sair por portal
  próprio ou só pela Central do Registro Civil, e dos modelos oficiais.
- **BREAKING:** nenhuma. Tabelas novas, só acrescentando; nada existente muda ou é apagado.

## Capabilities

### New Capabilities

- `rcpn-registry-index`: área RCPN do painel. Importação universal de arquivos, leitura,
  ligação de colunas, conferência, índice de registros, pesquisa interna e permissões.
- `rcpn-registry-lookup`: consulta pública "Seu registro é daqui?". Identificação de quem
  consulta, resposta com profissão e anotações encontradas, avisos, encaminhamento aos pedidos
  e proteção contra abuso.

### Modified Capabilities

- (nenhuma: os atos `rcpn-certidao`, `rcpn-certidao-inteiro-teor` e `rcpn-busca` passam a
  receber o registro localizado como dado de entrada, sem mudar o que exigem)

## Impact

- **Banco:** tabelas novas (arquivos importados, importações, modelos de ligação, registros do
  índice, consultas públicas). Migração só acrescenta.
- **Armazenamento:** envio direto ao armazenamento, em partes, para arquivos acima do limite
  da Vercel (o `NA.mdb` analisado tem 24 MB).
- **Dependências:** leitores de Access (`mdb-reader`), de planilha e de pacote compactado.
- **LGPD:** a base de registrados passa a morar na plataforma. Isso precisa entrar no
  inventário de tratamento da serventia (Adequação ao Provimento). Testes e desenvolvimento só
  com dados fictícios.
- **Telas:** área nova no painel e página nova no site, no design system existente.
