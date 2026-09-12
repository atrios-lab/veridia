## MODIFIED Requirements

### Requirement: Imprimir o requerimento no balcão
O detalhe do pedido DEVE (SHALL) oferecer a impressão do requerimento em PDF, gerado pela sessão
do painel sem exigir a chave de acesso, com a mesma identidade visual e o mesmo conteúdo do
arquivo que o cidadão baixa. Quando o pedido já tem o requerimento assinado anexado, a ação
DEVE (SHALL) apresentar-se como via assinada e abrir esse arquivo em vez de gerar um novo.
Enquanto uma chave recém-emitida estiver visível na tela, o painel DEVE (SHALL) oferecer também
o comprovante de acesso; fora desse momento, NÃO DEVE (SHALL NOT) existir caminho no painel que
produza a chave em claro.

O comprovante, por carregar a chave que só existe naquela resposta, DEVE (SHALL) ser entregue como
download direto na resposta à requisição que traz a chave, sem abrir visualizador: é o único
documento do painel que não pode ser servido por um endereço GET, e um documento aberto em
visualizador precisa de um endereço GET para ser salvo. O botão DEVE (SHALL) dizer que baixa, não
que imprime. Os demais documentos do painel (requerimento, declaração preenchida, formulário em
branco, anexos) DEVEM (SHALL) continuar servidos por GET autenticado pela sessão, de modo que
salvar pelo visualizador do navegador repita a mesma requisição e funcione.

Em pedido com gratuidade, o detalhe DEVE (SHALL) oferecer também a impressão da **declaração de
hipossuficiência** preenchida (Anexo I do Provimento CGJ/TJRN n. 7/2026), pela mesma sessão, com
o mesmo conteúdo do arquivo que o cidadão baixa, registrada na auditoria. O painel DEVE (SHALL)
oferecer ainda o formulário em branco, para entregar a quem preenche à mão.

#### Scenario: Folha para assinar no balcão
- **WHEN** o operador aciona a impressão num pedido sem requerimento assinado
- **THEN** recebe o requerimento em PDF do pedido, sem chave de acesso em página nenhuma

#### Scenario: Via assinada quando ela existe
- **WHEN** o pedido tem um requerimento assinado devolvido pelo cidadão
- **THEN** a ação de imprimir abre o arquivo assinado, que é o papel que o balcão arquiva

#### Scenario: Comprovante só enquanto a chave está na tela
- **WHEN** o operador acabou de emitir uma nova chave e ela está visível
- **THEN** pode baixar o comprovante de acesso com essa chave; ao sair da tela, o caminho desaparece

#### Scenario: O comprovante baixa direto
- **WHEN** o operador aciona "Baixar comprovante (PDF)" no detalhe ou no lançamento manual
- **THEN** o navegador salva `comprovante-<protocolo>.pdf` sem abrir visualizador, e a tela com a
  chave continua onde estava

#### Scenario: Salvar pelo visualizador funciona nos demais documentos
- **WHEN** o operador abre o requerimento ou a declaração na aba e clica no botão de download do
  visualizador, que refaz a requisição por GET
- **THEN** recebe o mesmo PDF, autenticado pela sessão

#### Scenario: Rota autenticada por sessão
- **WHEN** a rota de impressão é chamada sem sessão com `requests.manage`
- **THEN** a resposta nega o acesso, sem gerar documento

#### Scenario: Declaração preenchida impressa do detalhe
- **WHEN** o operador aciona a impressão da declaração num pedido com gratuidade
- **THEN** recebe o Anexo I preenchido com o que o pedido tem, os campos não coletados em branco,
  e a auditoria registra a impressão

#### Scenario: Declaração não existe em pedido sem gratuidade
- **WHEN** a rota da declaração é chamada para um pedido sem gratuidade
- **THEN** a resposta é "não encontrado" e o detalhe não oferece a ação
