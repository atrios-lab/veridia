## 0. Antes de começar

- [ ] 0.1 Confirmar com a serventia se há banco do Cartosoft posterior a 2016 e em que formato.
- [ ] 0.2 Confirmar a lista de finalidades e se a consulta aceita "sou pai ou mãe no
  registro".
- [x] 0.3 Dados de teste **fictícios** (tabelas do Cartosoft e cargas XML) nos testes. Nenhum
  dado real no código.
- [ ] 0.4 Banco Access e pacotes ZIP e RAR fictícios para testes automáticos da leitura (hoje a
  leitura de Access e RAR foi conferida à mão com o banco da serventia, só em contagens).

## 1. Fase 1: painel (índice)

- [x] 1.1 Núcleo puro: campos do índice, normalização de nome (acentos, partículas),
  validação de matrícula CNJ, conferência (contagens, problemas, duplicados). Testes.
- [x] 1.2 Migração só com tabelas novas: importações, registros e pessoas (0060). Modelos de
  ligação, imagens e consultas públicas entram com as tarefas 1.7, 1.12 e 2.3.
- [x] 1.3 Envio direto ao armazenamento em partes, hash SHA-256 e repetidos.
- [x] 1.4 Reconhecimento pelo conteúdo e abertura de pacotes ZIP e RAR, com limites (ver 0.4).
- [ ] 1.5 Leitores: Access e carga XML prontos (com ZIP e RAR); faltam dBase, SQLite, sql
  (só leitura), planilhas, texto delimitado e fixo, JSON e os demais XMLs (certidão da CRC,
  e-Proclamas, óbito da carga).
- [x] 1.6 Modelo pronto do Cartosoft (Access): nascimento, casamento e óbito, descartando os
  campos fora do índice.
- [ ] 1.7 Tela de ligação de colunas e modelos salvos.
- [ ] 1.12 Imagens das folhas (TIFF, JPG, PDF) ligadas ao registro.
- [x] 1.8 Tela de conferência e publicação (substitui pela matrícula), com auditoria e rótulos.
- [x] 1.9 Pesquisa interna tolerante a grafia e período coberto.
- [x] 1.10 Permissões "RCPN: pesquisar" e "RCPN: importar arquivos" em Perfis e permissões;
  item na barra lateral.
- [x] 1.11 Verificar no navegador com dados fictícios; bateria completa.

## 2. Fase 2: site (consulta pública)

- [ ] 2.1 Núcleo puro da resposta: localizado, profissão por pessoa, casamento e óbito
  encontrados, textos que nunca afirmam ausência. Testes.
- [ ] 2.2 Página "Seu registro é daqui?" com identificação, finalidade e declaração, atrás do
  gating de seção.
- [ ] 2.3 Correspondência exata, limite de tentativas e registro das consultas.
- [ ] 2.4 Botões para `rcpn-certidao`, `rcpn-certidao-inteiro-teor` e `rcpn-busca` já
  preenchidos; o pedido mostra ao cartório o registro localizado.
- [ ] 2.5 Lista das consultas na área RCPN.
- [ ] 2.6 Verificar no navegador com dados fictícios; bateria completa.

## 3. Depois (mudança própria)

- [ ] 3.1 Certidão pelo portal: conferir na norma (portal próprio ou Central do Registro Civil),
  modelos oficiais e selo do TJRN antes de propor.

## 4. Acrescentado em 14/11/2026

- [x] 4.1 Registro que já existe: conferência com valor antigo e novo; substitui só o marcado.
- [x] 4.2 Natimortos (Livro C Auxiliar) como subdivisão de Óbitos.
- [x] 4.3 "!" explicativo nas telas e nos quadros do índice.
- [x] 4.4 Arquivo original apagado do painel ao publicar ou descartar.
- [x] 4.5 Grupo "Atribuições" na barra lateral, com o Registro Civil.

## 5. Certidões pelo painel (14/11/2026)

- [x] 5.1 Modelos nacionais de nascimento, casamento e óbito, matrícula em blocos, data por
  extenso e preenchimento pelo índice. Testes.
- [x] 5.2 Tabela só nova (na mesma 0060), emissão com conferência do livro, selo colado (sem repetir),
  correção e exclusão com justificativa (exclusão só marca), anexo da via assinada, auditoria.
- [x] 5.3 PDF para imprimir ou assinar digitalmente; permissão própria; "!" na tela.
- [x] 5.4 Verificar no navegador com dados fictícios.
- [ ] 5.5 Selo puxado do Caixa (quando o Caixa existir), em vez de colado.
- [x] 5.6 Nascimento e inteiro teor no modelo do Provimento 182; impressão no papel de segurança
  (topo livre, medidas do modelo), uma folha.
- [ ] 5.7 Casamento e óbito no modelo do Provimento 182, quando a serventia enviar os modelos.

## 6. Guias das atribuições (14/11/2026)

- [x] 6.1 Guias de Registro Civil, Imóveis, Títulos e Documentos, Pessoas Jurídicas, Protesto,
  Distribuição, Notas e Caixa, só com a lei federal citada artigo por artigo; o resto marcado
  para conferir no Código de Normas do RN. Testes dos atalhos e das fontes.
- [x] 6.2 Barra lateral com uma entrada por atribuição; Atribuições recolhível como Utilitários,
  com as telas do Registro Civil como subitens.
- [x] 6.3 Permissão própria e "!" em cada parte do guia; verificar no navegador.
- [ ] 6.4 Índices digitais de cada atribuição (como o do Registro Civil), com os arquivos do
  sistema da serventia.
- [ ] 6.5 Incluir no guia os artigos do Código de Normas do RN quando a serventia conferir.
- [x] 6.6 Estrutura da matrícula (modelo da serventia, Lei 6.015/1973, arts. 176 e 232) no guia
  do Registro de Imóveis, sem dado de cliente.
- [ ] 6.7 Abrir e imprimir matrícula e certidão de matrícula pelo painel.

## 7. Arquivos e roteiros em todas as atribuições (14/11/2026)

- [x] 7.1 Arquivos em todas as atribuições: qualquer formato, tipo pelo conteúdo, sem repetir,
  envio direto, exclusão com justificativa que só marca (migração 0061, só cria tabela).
- [x] 7.2 Roteiros dos atos com os requisitos da lei (Notas, Protesto, RI, RTD, RCPJ, Registro
  Civil, Caixa).
- [ ] 7.3 Leitores dos formatos das centrais, pela pesquisa de 14/11/2026 (conferir os leiautes
  oficiais antes): títulos XML do ONR, remessa e retorno da CRA, atualização diária da CENPROT
  (XML), carga da CRC e do SIRC, DOI (JSON).
- [ ] 7.4 Livros e índices digitais de cada atribuição (como o do Registro Civil): RI (livros 1 a
  5, CNM), RTD (livros A a D), RCPJ (livros A e B), Protesto (protocolo e registro, com guarda de
  3 e 10 anos), Notas (escrituras, procurações, testamentos, CENSEC).
- [ ] 7.5 Minutas de atos com os campos preenchidos e o selo do SIEX/TJRN em todo ato (pedir ao
  TJRN o leiaute e o prazo do SIEX).
- [ ] 7.6 Calendário de dias úteis (feriados do RN e do município) para os prazos registrais e do
  protesto.

## 8. Informações gerais por livro (14/11/2026)

- [x] 8.1 Leitura dos dados da certidão no banco do Cartosoft (NA, CA, OB), com as colunas
  apontadas pelo modelo do Provimento 182 da serventia; coluna nova `details` (migração 0062,
  só acrescenta); campo em branco não apaga.
- [x] 8.2 Livros e índice de cada livro; página do registro com a certidão como vai sair.
- [x] 8.3 Certidão preenchida com o índice e os dados do livro. Testes com dados fictícios.
- [x] 8.4 Os mesmos dados completos a partir da carga XML (leiaute CRC/SIRC: NA_INC, CA_INC,
  OB_INC), com livro, folha e termo tirados da matrícula; natimorto pelo Livro C Auxiliar.
- [x] 8.5 Base inteira num envio (cerca de 24 mil registros): publicação em lotes de 500 e tempo
  maior para as telas de importar e conferir.

## 9. Atribuições que a serventia oferece (14/11/2026)

- [x] 9.1 Marcar e desmarcar as atribuições em Configurações (só o Tabelião), com o regime de cada
  uma (delegado, interino, interventor) e a Distribuição; auditoria.
- [x] 9.2 Painel e site mostram só o que a serventia oferece; cartão "Atribuições" na página inicial.

## 10. Envio grande e erros em português (14/11/2026)

- [x] 10.1 Conferência com muitos registros alterados: os 200 primeiros para marcar e "Substituir
  todos", para a tela ficar abaixo do limite de resposta da hospedagem (4,5 MB).
- [x] 10.2 Telas de erro em português no painel, no site e geral ("em manutenção"), dizendo se foi
  tamanho, tempo, conexão ou outro erro, com o código para o suporte.
- [x] 10.3 Registro das etapas do envio no servidor (tempo e tamanho, sem dado pessoal).

## 11. Ficha completa e pesquisa por livro (14/11/2026)

- [x] 11.1 Leitura de todos os campos da carga XML e do banco (NA, CA, OB): filiação completa,
  avós, declarante, testemunhas, anotações, cônjuges e óbito; códigos numéricos sem adivinhar.
- [x] 11.2 Carga e banco no mesmo envio juntados pela matrícula.
- [x] 11.3 Abas Nascimentos, Casamentos e Óbitos (tela e barra lateral) com pesquisa por nome,
  filiação, avós, termo, livro, matrícula, DNV, CPF e datas.
- [x] 11.4 Ficha completa do registro, alterar com justificativa e histórico, cancelar e estornar;
  permissão própria em Perfis e permissões; auditoria; migração só acrescenta.
- [x] 11.5 Importação não sobrescreve registro corrigido no painel com "Substituir todos".
- [x] 11.6 Tudo editável para retificação ou erro de digitação, menos a matrícula (ficha e
  certidão de um registro), também no servidor.
- [x] 11.7 Tabelas do Access exportadas em XML (dataroot) lidas juntas, como um banco; a
  certidão impressa (CV_NASCIMENTO) completa, pela matrícula, o que o registro deixou em branco;
  segundo declarante; aviso de que o .xsd não traz registros.
- [x] 11.8 Versão nova das tabelas de nascimento: naturalidade escrita, CPF do registrado e dos
  pais, e NA_FILIACAO (genitores com os seus pais, os avós) onde as tabelas antigas deixam em branco.
- [x] 11.9 Datas com ano impossível no banco (digitado errado) ficam em branco, sem adivinhar.
- [x] 11.10 Prévia da certidão antes de emitir, na ficha (breve e inteiro teor) e no formulário, com
  "PRÉVIA" em cada folha, para conferir e imprimir; nada é gravado e o selo não é usado.
- [x] 11.11 Instruções de envio na tela: até 500 MB por envio, compactar em .zip, fechar o sistema
  antes de copiar o banco; aviso antes de enviar arquivo maior.
