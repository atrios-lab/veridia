## 0. Antes de começar

- [ ] 0.1 Confirmar com a serventia se há banco do Cartosoft posterior a 2016 e em que formato.
- [ ] 0.2 Confirmar a lista de finalidades e se a consulta aceita "sou pai ou mãe no
  registro".
- [ ] 0.3 Criar bancos Access, planilha e pacote de teste **fictícios**, na estrutura do
  Cartosoft, para os testes. Nenhum dado real no código.

## 1. Fase 1: painel (índice)

- [ ] 1.1 Núcleo puro: campos do índice, normalização de nome (acentos, partículas),
  validação de matrícula CNJ, conferência (contagens, problemas, duplicados). Testes.
- [ ] 1.2 Migração só com tabelas novas: arquivos, importações, modelos de ligação, registros,
  ligação de imagem, consultas públicas.
- [ ] 1.3 Envio direto ao armazenamento em partes, hash SHA-256 e repetidos.
- [ ] 1.4 Reconhecimento pelo conteúdo e abertura de pacotes, com limites. Testes com
  pacotes fictícios.
- [ ] 1.5 Leitores: Access, dBase, SQLite, sql (só leitura), planilhas, texto delimitado e
  fixo, XML, JSON. Cada um vira "tabelas e colunas".
- [ ] 1.6 Modelo pronto do Cartosoft (Access): nascimento, casamento e óbito, descartando os
  campos fora do índice.
- [ ] 1.7 Tela de ligação de colunas e modelos salvos.
- [ ] 1.8 Tela de conferência e publicação (substitui pela matrícula), com auditoria e rótulos.
- [ ] 1.9 Pesquisa interna tolerante a grafia; detalhe do registro; período coberto.
- [ ] 1.10 Permissões "RCPN: pesquisar" e "RCPN: importar arquivos" em Perfis e permissões;
  item na barra lateral.
- [ ] 1.11 Verificar no navegador com dados fictícios; bateria completa.

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
