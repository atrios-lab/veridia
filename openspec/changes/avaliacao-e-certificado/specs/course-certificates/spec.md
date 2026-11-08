## ADDED Requirements

### Requirement: Avaliação configurada por curso

Um curso SHALL ter avaliação quando tem carga horária definida e ao menos uma questão ativa. A avaliação SHALL ter nota mínima em percentual (padrão 70) e intervalo entre tentativas em horas (padrão 5), definidos pela plataforma.

Cada questão SHALL ter:
- um enunciado;
- exatamente quatro alternativas;
- uma única alternativa certa.

#### Scenario: Curso com avaliação
- **WHEN** o curso de LGPD tem carga horária de 2 h e 10 questões ativas
- **THEN** a página do curso oferece a avaliação a quem assistiu a tudo

#### Scenario: Curso sem avaliação
- **WHEN** o curso "Uso do painel" não tem carga horária
- **THEN** a página dele não mostra avaliação nem certificado

### Requirement: Avaliação abre depois de assistir a tudo

A avaliação SHALL ficar disponível só depois que a pessoa assistiu a todos os vídeos publicados do curso, inclusive o Encerramento. Antes disso, a página SHALL mostrar quantos vídeos faltam.

#### Scenario: Falta o Encerramento
- **WHEN** a pessoa assistiu à Apresentação e às 12 aulas, mas não ao Encerramento
- **THEN** a avaliação aparece fechada, com a indicação de que falta 1 vídeo

#### Scenario: Tudo assistido
- **WHEN** a pessoa termina o Encerramento
- **THEN** a página oferece "Iniciar avaliação"

### Requirement: Tentativa embaralhada e sem gabarito

Ao iniciar uma tentativa, o servidor SHALL sortear a ordem das questões ativas e a ordem das alternativas de cada questão, e SHALL gravar esse sorteio na tentativa. Recarregar a página durante uma tentativa aberta SHALL mostrar a mesma ordem.

O navegador NÃO SHALL receber, em nenhum momento, qual alternativa é a certa. A correção SHALL ser feita no servidor.

O resultado SHALL mostrar:
- quantas questões a pessoa acertou e o total;
- se foi aprovada.

O resultado NÃO SHALL mostrar quais questões ela errou nem quais eram as respostas certas.

O servidor SHALL recusar:
- o envio de uma tentativa já enviada;
- um envio com questão sem resposta.

#### Scenario: Ordem muda entre tentativas
- **WHEN** a pessoa faz duas tentativas
- **THEN** as questões e as alternativas aparecem em ordens sorteadas de novo em cada uma

#### Scenario: Recarregar não sorteia de novo
- **WHEN** a pessoa recarrega a página no meio de uma tentativa
- **THEN** as questões continuam na mesma ordem

#### Scenario: Resposta certa não sai do servidor
- **WHEN** a resposta do servidor ao iniciar uma tentativa é inspecionada
- **THEN** ela traz só enunciados e alternativas, sem indicar a certa

#### Scenario: Resultado sem gabarito
- **WHEN** a pessoa envia a tentativa com 6 acertos de 10
- **THEN** a tela informa "Você acertou 6 de 10" e que não atingiu a nota mínima, sem indicar quais errou

### Requirement: Nota mínima e intervalo entre tentativas

A tentativa SHALL ser aprovada quando a proporção de acertos é igual ou maior que a nota mínima do curso.

Depois de uma tentativa reprovada, uma nova tentativa SHALL ficar disponível só quando o intervalo do curso, contado do envio, tiver passado pelo relógio do servidor. A página SHALL mostrar quanto falta.

Depois de uma tentativa aprovada, NÃO SHALL haver nova tentativa.

#### Scenario: Aprovado com 70%
- **WHEN** a pessoa acerta 7 de 10 num curso com nota mínima 70
- **THEN** a tentativa é aprovada

#### Scenario: Espera de 5 horas
- **WHEN** a pessoa reprova às 10h00
- **THEN** às 14h00 a página informa que faltam 1 h, e às 15h00 oferece nova tentativa

#### Scenario: Aprovado não refaz
- **WHEN** a pessoa já foi aprovada
- **THEN** a página não oferece nova tentativa e leva ao certificado

### Requirement: Emissão do certificado com nome, CPF e função

Depois da aprovação, a pessoa SHALL informar:
- o nome completo, com ao menos duas palavras e pré-preenchido com o nome da conta;
- o CPF, com dígitos verificadores válidos;
- a função, de 2 a 60 caracteres.

A tela SHALL dizer que esses dados são usados só para emitir e validar o certificado. Antes de emitir, a tela SHALL mostrar como o texto do certificado vai sair.

A emissão SHALL gravar:
- um código de validação único, aleatório, de 12 caracteres;
- a serventia da pessoa, o título do curso, a carga horária, o aproveitamento e a data, como estavam no momento da emissão.

A emissão SHALL criar um único certificado por pessoa e por curso. Emitido, ele NÃO SHALL ser alterado pela pessoa.

#### Scenario: CPF inválido
- **WHEN** a pessoa informa um CPF com dígito verificador errado
- **THEN** o formulário recusa e nada é emitido

#### Scenario: Emissão
- **WHEN** a pessoa aprovada informa nome, CPF e função válidos e confirma
- **THEN** o certificado é emitido com um código de validação e a página passa a oferecer "Baixar certificado"

#### Scenario: Segunda emissão
- **WHEN** a pessoa que já tem certificado do curso tenta emitir de novo
- **THEN** o servidor recusa e mantém o certificado existente

### Requirement: Certificado em PDF assinado digitalmente

O certificado SHALL ser um PDF com:
- nome, CPF completo, função e serventia;
- título do curso, carga horária, aproveitamento e data de conclusão;
- código de validação e QR com o endereço de validação;
- o nome "Joelison Alves Marinho" como instrutor, com a imagem da assinatura dele acima do nome;
- a assinatura digital da Átrios com certificado ICP-Brasil, em formato PAdES, e um bloco visível indicando essa assinatura.

O endereço de validação SHALL usar o host da serventia em que o certificado foi emitido.

A imagem da assinatura NÃO SHALL ser servida por nenhuma rota pública: ela existe só dentro do PDF.

Sem o certificado de assinatura configurado:
- em produção, o download SHALL falhar com mensagem genérica, e NÃO SHALL entregar PDF sem assinatura;
- fora de produção, o PDF SHALL sair marcado como documento de teste.

#### Scenario: PDF assinado
- **WHEN** a pessoa baixa o certificado em produção
- **THEN** o PDF abre com a assinatura digital da Átrios reconhecida como ICP-Brasil e com o nome de Joelison Alves Marinho como instrutor

#### Scenario: Alteração quebra a assinatura
- **WHEN** o PDF baixado é alterado e aberto num leitor de PDF
- **THEN** o leitor aponta a assinatura como inválida

#### Scenario: Produção sem certificado de assinatura
- **WHEN** as variáveis do certificado A1 não estão configuradas em produção
- **THEN** o download falha com aviso e nenhum PDF é entregue

### Requirement: Download só pela própria pessoa

O PDF do certificado SHALL ser entregue só a uma sessão autenticada que seja a dona do certificado. Ele SHALL ser gerado no momento do download, a partir dos dados gravados na emissão, sem guardar o PDF com o CPF completo em armazenamento público. A resposta NÃO SHALL ser guardada em cache.

#### Scenario: Outra pessoa tenta baixar
- **WHEN** uma sessão de outra pessoa chama o download do certificado de um curso
- **THEN** recebe o próprio certificado se tiver um, ou nada, nunca o de outra pessoa

### Requirement: Validação pública do certificado

A rota `/certificado/<código>` SHALL ser pública, funcionar em qualquer host de serventia e mostrar, para um código existente:
- o nome;
- o CPF mascarado, com os 3 primeiros e os 2 últimos dígitos ocultos;
- a função e a serventia;
- o curso, a carga horária, o aproveitamento e a data;
- a indicação de assinatura digital da Átrios.

Para um código inexistente ou malformado, SHALL responder 404 com a mesma aparência, sem distinguir os dois casos. A página NÃO SHALL ser indexada e SHALL limitar consultas por IP.

#### Scenario: Código válido
- **WHEN** alguém abre `/certificado/<código emitido>`
- **THEN** vê o certificado válido, com o CPF no formato `***.456.789-**`

#### Scenario: Código inexistente
- **WHEN** alguém abre `/certificado/AAAA-BBBB-CCCC` e esse código não existe
- **THEN** vê "Certificado não encontrado", com status 404

#### Scenario: Muitas consultas
- **WHEN** um mesmo IP faz mais de 30 consultas em 10 minutos
- **THEN** as seguintes são recusadas até a janela passar

### Requirement: Gerenciamento da avaliação

Em `/admin/ajuda/gerenciar`, uma sessão com `tutorials.manage` SHALL, para cada curso:
- definir a nota mínima, a carga horária e o intervalo entre tentativas;
- criar, editar, ativar e desativar questões.

Uma questão já usada em alguma tentativa NÃO SHALL ser excluída, só desativada. As ações SHALL ser auditadas sob o slug da plataforma. A emissão de certificado SHALL ser auditada sob a serventia da pessoa.

#### Scenario: Cadastrar questão
- **WHEN** o superadmin cadastra uma questão com enunciado, quatro alternativas e a certa marcada
- **THEN** ela passa a entrar nas próximas tentativas do curso

#### Scenario: Questão usada não é excluída
- **WHEN** o superadmin tenta excluir uma questão que já apareceu numa tentativa
- **THEN** a exclusão é recusada e a questão pode ser desativada
