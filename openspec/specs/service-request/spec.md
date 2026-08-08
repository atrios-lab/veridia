# service-request

## Purpose

TBD

## Requirements

### Requirement: Validação client-side do formulário com o mesmo schema do servidor
O formulário do pedido DEVE (SHALL) validar os campos no cliente com react-hook-form usando o
mesmo schema Zod do núcleo (`serviceRequestSchema(act)`), sem schema paralelo. Erros DEVEM
(SHALL) aparecer por campo, em português, a partir do blur do campo, e o envio DEVE (SHALL) ser
bloqueado enquanto houver erro de validação no cliente. A validação do servidor DEVE (SHALL)
permanecer integral: o cliente é conveniência, o servidor é a fronteira de confiança.

#### Scenario: Erro apontado sem ida ao servidor
- **WHEN** o cidadão preenche um CPF inválido e sai do campo
- **THEN** a mensagem "CPF inválido." aparece junto ao campo sem requisição ao servidor

#### Scenario: Envio bloqueado com aceite faltante
- **WHEN** o cidadão tenta enviar sem marcar o aceite de LGPD
- **THEN** o formulário não é submetido e o erro aparece junto ao aceite

#### Scenario: Servidor continua validando
- **WHEN** uma submissão chega ao server action sem passar pela validação do cliente (ex.: script)
- **THEN** o servidor rejeita com os mesmos erros de campo de antes

#### Scenario: Erro que só o servidor conhece continua exibido
- **WHEN** o cliente aprova os campos mas o servidor reprova (ex.: anexo inválido ou rate limit)
- **THEN** a mensagem de erro do servidor é exibida no formulário como hoje

### Requirement: Máscaras de CPF e telefone durante a digitação
O campo de CPF DEVE (SHALL) formatar o valor como `000.000.000-00` enquanto o cidadão digita.
O campo de contato DEVE (SHALL) formatar como telefone `(00) 00000-0000` apenas quando o valor
digitado for numérico, preservando a digitação livre de e-mail. A máscara é apresentação: o
servidor DEVE (SHALL) continuar aceitando o valor com ou sem pontuação.

#### Scenario: CPF ganha máscara ao digitar
- **WHEN** o cidadão digita "12345678909" no campo CPF
- **THEN** o campo exibe "123.456.789-09"

#### Scenario: Contato numérico ganha máscara de telefone
- **WHEN** o cidadão digita "84990000000" no campo de contato
- **THEN** o campo exibe "(84) 99000-0000"

#### Scenario: E-mail não é mascarado
- **WHEN** o cidadão digita "voce@exemplo.com" no campo de contato
- **THEN** o valor permanece exatamente como digitado

### Requirement: Catálogo completo de atos com selo de tramitação
O catálogo do núcleo DEVE (SHALL) cobrir os atos das seis atribuições (conferidos contra o sistema
anterior, com base legal), cada ato com modo de tramitação (`identification`, `online`,
`presential`), documentos esperados quando houver, finalidade apenas nos atos que a exigem
(certidão nunca exige — Lei 6.015 art. 17) e descrição obrigatória nos atos "outro". A
exibição DEVE (SHALL) traduzir o modo em linguagem direta: "Só identificação", "100% on-line",
"On-line + presencial".

#### Scenario: Filtro por atribuição do tenant
- **WHEN** um tenant não possui uma atribuição
- **THEN** nenhum ato dela aparece no wizard, e a contagem "N atos" dos cards reflete só os atos disponíveis

#### Scenario: Selo em linguagem direta
- **WHEN** a etapa 2 lista um ato `presential`
- **THEN** o selo mostra "On-line + presencial" com a explicação de que o pedido adianta a análise e o ato termina no balcão

### Requirement: Wizard de solicitação em três etapas
`/solicitar` DEVE (SHALL) guiar o cidadão por Atribuição → Ato → Pedido com indicador de progresso,
cards de atribuição com exemplos do dia a dia (não apenas siglas), possibilidade de trocar a
escolha em qualquer etapa, e — na etapa 3 — o ato escolhido fixo no topo com ação "trocar" e
checklist informativo dos documentos do ato. O estado do wizard DEVE (SHALL) viver na URL (voltar do
navegador funciona).

#### Scenario: Leigo encontra o serviço
- **WHEN** o cidadão abre a etapa 1
- **THEN** cada card mostra o nome da atribuição em linguagem comum com exemplos ("Certidão de nascimento, casamento…") e a contagem de atos

#### Scenario: Trocar sem perder o fluxo
- **WHEN** o cidadão clica "trocar" na etapa 3
- **THEN** ele volta à etapa 2 da mesma atribuição, mantendo a jornada

### Requirement: Formulário do pedido com aceites e anti-spam invisível
O formulário DEVE (SHALL) pedir nome, e-mail/WhatsApp, CPF opcional, descrição (obrigatória quando o
ato exige), finalidade quando o ato exige, anexos opcionais (até 5, imagem ou PDF, validados
no servidor) e aceites obrigatórios de LGPD e veracidade. O anti-spam DEVE (SHALL) ser um honeypot
invisível (campo `website`): sem CAPTCHA. Submissões com honeypot preenchido DEVEM (SHALL) receber
resposta de sucesso falsa sem gravação. A rota DEVE (SHALL) aplicar rate limit.

#### Scenario: Aceites obrigatórios
- **WHEN** o cidadão envia sem marcar um dos aceites
- **THEN** o servidor rejeita com erro de validação apontando o aceite faltante

#### Scenario: Robô cai no honeypot
- **WHEN** uma submissão chega com o campo `website` preenchido
- **THEN** a resposta simula sucesso e nenhum pedido é gravado

#### Scenario: Anexo inválido
- **WHEN** um arquivo que não é imagem nem PDF (ou excede o tamanho máximo) é enviado
- **THEN** o servidor rejeita a submissão com mensagem clara, independentemente do `accept` do input

### Requirement: Protocolo sequencial e chave de acesso exibida uma única vez
Ao gravar, o sistema DEVE (SHALL) gerar protocolo `REQ.AAAA.NNNNNN` (sequência por tenant e ano, sem
colisão sob concorrência) e uma chave de acesso `XXXX-XXXX-XXXX` (alfabeto sem caracteres
ambíguos). A chave DEVE (SHALL) ser armazenada apenas como hash; o texto claro aparece somente na
resposta da submissão (e impresso no PDF do requerimento). O pedido nasce com status `new`,
escopado ao tenant, e a criação DEVE (SHALL) ser auditada.

#### Scenario: Sucesso mostra protocolo e chave uma vez
- **WHEN** a submissão é aceita
- **THEN** a tela de sucesso mostra protocolo e chave com botões copiar e o aviso de que a chave não será reexibida; recarregar a página não a mostra de novo

#### Scenario: Chave não recuperável do banco
- **WHEN** qualquer consulta lê o registro do pedido
- **THEN** apenas o hash da chave existe; o texto claro não está armazenado

### Requirement: Requerimento em PDF e envio do assinado
A tela de sucesso DEVE (SHALL) oferecer: (1) download do requerimento em PDF pré-preenchido (dados do
pedido, serventia, protocolo e chave impressos) para assinatura digital via Gov.br ou de
próprio punho; (2) envio do requerimento assinado ali mesmo, como anexo do pedido — sem que a
falta do envio trave o registro do pedido; (3) os três próximos passos numerados. O download
do PDF DEVE (SHALL) exigir a chave de acesso.

#### Scenario: PDF protegido pela chave
- **WHEN** a rota do PDF é chamada com protocolo válido e chave errada
- **THEN** a resposta é 404, sem vazar a existência do pedido

#### Scenario: A chave não trafega em URL
- **WHEN** o cidadão baixa o requerimento pela tela de sucesso
- **THEN** protocolo e chave vão no corpo da requisição, nunca em query string (que ficaria no histórico do navegador e nos logs)

#### Scenario: Envio do assinado é opcional
- **WHEN** o cidadão fecha a tela de sucesso sem anexar o requerimento assinado
- **THEN** o pedido permanece registrado e o assinado pode ser entregue depois (pela consulta ou no balcão)
