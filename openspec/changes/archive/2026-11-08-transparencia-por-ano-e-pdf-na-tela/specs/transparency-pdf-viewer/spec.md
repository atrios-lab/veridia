## ADDED Requirements

### Requirement: PDF aberto numa janela sobre a página

O clique num documento ou num boletim de `/transparencia` SHALL, em aparelho com tela de pelo menos
768px e ponteiro de precisão, abrir o PDF numa janela modal sobre a própria página, sem trocar
de aba. A janela SHALL mostrar o título do PDF e as opções "Abrir em nova aba" e "Baixar", e SHALL
fechar pelo botão de fechar, pela tecla Esc ou pelo clique fora dela, devolvendo o foco ao item
clicado.

#### Scenario: Ver o boletim sem sair da página

- **WHEN** o cidadão, no computador, clica em agosto de 2026
- **THEN** o PDF do boletim aparece numa janela sobre /transparencia, e a página continua na mesma
  aba e na mesma posição de rolagem

#### Scenario: Abrir em nova aba pela janela

- **WHEN** o cidadão clica em "Abrir em nova aba" na janela
- **THEN** o mesmo PDF abre numa aba nova

#### Scenario: Baixar pela janela

- **WHEN** o cidadão clica em "Baixar" na janela
- **THEN** o navegador baixa o arquivo, com o nome que a rota já informa

#### Scenario: Fechar com Esc

- **WHEN** a janela está aberta e o cidadão aperta Esc
- **THEN** a janela fecha e o foco volta para o item que a abriu

### Requirement: Celular e cliques modificados abrem aba nova

O item SHALL abrir o PDF em aba nova, como antes desta mudança, em tela com menos de 768px ou sem
ponteiro de precisão, e em qualquer aparelho quando o clique vier com Ctrl, ⌘, Shift ou com o botão
do meio. Nesses casos, o item MUST NOT abrir a janela. Sem JavaScript, todo item SHALL continuar sendo um link que abre o PDF em aba nova.

#### Scenario: Celular

- **WHEN** o cidadão toca num boletim pelo celular
- **THEN** o PDF abre numa aba nova, e nenhuma janela aparece

#### Scenario: Ctrl+clique no computador

- **WHEN** o cidadão dá Ctrl+clique num documento
- **THEN** o navegador abre o PDF em aba nova em segundo plano, e nenhuma janela aparece

### Requirement: Moldura permitida só nos PDFs públicos da transparência

As respostas de `/transparencia/documento/<id>` e `/transparencia/boletim/<id>` SHALL permitir
exibição em moldura apenas pela mesma origem (`frame-ancestors 'self'` e `X-Frame-Options:
SAMEORIGIN`). Todas as outras rotas do site MUST continuar recusando qualquer moldura
(`frame-ancestors 'none'` e `X-Frame-Options: DENY`). `object-src` MUST continuar `'none'`.

#### Scenario: Rota de PDF aceita a própria origem

- **WHEN** a rota `/transparencia/boletim/<id>` responde
- **THEN** a resposta traz `frame-ancestors 'self'` e um único `X-Frame-Options: SAMEORIGIN`

#### Scenario: Página comum continua fechada

- **WHEN** `/transparencia`, `/solicitar` ou qualquer rota de `/admin` responde
- **THEN** a resposta traz `frame-ancestors 'none'` e `X-Frame-Options: DENY`

#### Scenario: Caminho parecido não herda a exceção

- **WHEN** a rota `/transparencia/boletim/<id>/extra` ou `/transparencia/documentos` é requisitada
- **THEN** a resposta traz `frame-ancestors 'none'`
