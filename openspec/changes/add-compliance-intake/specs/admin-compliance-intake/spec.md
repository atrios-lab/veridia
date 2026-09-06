## ADDED Requirements

### Requirement: Coleta em seções com salvamento por campo
O painel SHALL oferecer, a quem tem `content.edit`, o módulo "Adequação ao Provimento" com 17 seções, uma por tela, na ordem do brief. Cada campo SHALL ser salvo no servidor ao ser deixado (texto) ou alterado (escolha), sem botão de salvar. A tela inicial SHALL mostrar o progresso "N de 17 seções", a lista das seções com o estado em palavra (não iniciada, em andamento, concluída) e um botão que leva à seção aberta mais recentemente editada.

#### Scenario: Resposta sobrevive a sair e voltar
- **WHEN** a titular marca "Windows 10" na Seção 8, fecha o navegador e reabre a Seção 8 em outro aparelho
- **THEN** "Windows 10" está marcado e a lista mostra a Seção 8 como "em andamento"

#### Scenario: Continuar de onde parei
- **WHEN** a serventia editou a Seção 10 ontem e a Seção 7 hoje, ambas incompletas
- **THEN** o botão da tela inicial leva à Seção 7

### Requirement: Pré-preenchimento com confirmação
As Seções 1, 2 e 5 SHALL vir preenchidas com o que o painel já sabe da serventia (nome, CNS, endereço, telefone, e-mail, atribuições, titular, encarregado). Uma seção pré-preenchida SHALL constar como "não iniciada" até a serventia abri-la e avançar, e o que a serventia digitar SHALL prevalecer sobre o pré-preenchido.

#### Scenario: Seção pré-preenchida aguarda confirmação
- **WHEN** a serventia abre o módulo pela primeira vez
- **THEN** a Seção 1 mostra os dados das Configurações e consta como "não iniciada", com a nota de que basta abrir para confirmar

### Requirement: Perguntas condicionais e "não sei"
Uma pergunta SHALL aparecer só quando fizer sentido para as respostas anteriores (autonomia do nobreak só com nobreak; Windows do servidor só com servidor na Seção 7; nomeação opcional do encarregado só na Classe 1). Campo oculto SHALL NOT contar como pendente. Onde o brief prevê, o campo SHALL oferecer "não sei", gravado como resposta distinta de vazio.

#### Scenario: Pergunta oculta não impede concluir
- **WHEN** a serventia responde "não" a "Tem nobreak?" e preenche o restante da Seção 10
- **THEN** a Seção 10 consta como "concluída" sem perguntar os minutos do nobreak

#### Scenario: "Não sei" é resposta, não vazio
- **WHEN** a serventia marca "não sei" na marca do roteador
- **THEN** a revisão mostra "Não sei" nesse campo e o perfil Átrios o lista entre os "não sei" a confirmar

### Requirement: Classe, subclasse e prazos
Informada a receita bruta do último semestre, o módulo SHALL mostrar a classe (1, 2 ou 3) e a subclasse (A a J) pela tabela do art. 16 do Provimento 243 e os prazos da Etapa 1 (300, 240 ou 180 dias) e da conclusão (36, 30 ou 24 meses) contados da vigência.

#### Scenario: Classe 1, subclasse B
- **WHEN** a receita informada é R$ 184.300,00
- **THEN** a tela mostra "Classe 1 · subclasse B" e a Etapa 1 até 18/06/2027

### Requirement: Aviso na hora da resposta
Windows 10 ou anterior, Office 2013 ou anterior, sem antivírus, sem backup, sem nobreak (ou com menos de 30 minutos), sem segundo fator (ou só em alguns sistemas), nuvem sem cifra na origem e backup nunca restaurado SHALL gerar um aviso logo abaixo do campo, no momento da resposta, dizendo que vira pendência de 30 dias e que não impede continuar. A lista das seções SHALL mostrar a contagem de avisos por seção.

#### Scenario: Windows 10 avisa e conta
- **WHEN** a serventia marca "Windows 10"
- **THEN** aparece "O Windows 10 está sem suporte desde 14/10/2025." abaixo da opção e a Seção 8 mostra "1 aviso" na lista

### Requirement: Revisão, declaração e envio
A tela de revisão SHALL listar tudo o que foi respondido, por seção, com "Editar" em cada uma, e as pendências detectadas. O envio SHALL exigir a declaração marcada e todas as seções concluídas, SHALL gravar data, autor e versão, SHALL enviar e-mail de confirmação à serventia e de aviso à Átrios, e SHALL manter a coleta editável. Edição depois do envio SHALL marcar a seção como "alterada após o envio" para o perfil Átrios.

#### Scenario: Envio grava e avisa
- **WHEN** a titular marca a declaração e clica "Enviar para a Átrios" com as 17 seções concluídas
- **THEN** a tela diz "Recebemos", a tela inicial passa a mostrar "Enviado à Átrios em [data]", e os dois e-mails saem

#### Scenario: Faltando seção não envia
- **WHEN** a Seção 12 está "não iniciada"
- **THEN** o botão de enviar fica desabilitado e a revisão diz quais seções faltam

#### Scenario: Alteração depois do envio
- **WHEN** a serventia edita a Seção 3 depois do envio
- **THEN** o perfil Átrios vê "alterada após o envio" na Seção 3, e o perfil da serventia vê "concluída"

### Requirement: Perfil Átrios e exportação
Dentro do painel da serventia, a conta `superadmin` SHALL ver, além do que a serventia vê, as pendências detectadas, os "não sei" e o botão "Exportar JSON". A rota de exportação SHALL recusar qualquer outro perfil e SHALL devolver o arquivo `<slug>.json` no vocabulário do gerador, sem edição manual. O perfil da serventia SHALL NOT ver o botão.

#### Scenario: Exportar é só da Átrios
- **WHEN** a titular abre a tela inicial do módulo
- **THEN** não há botão "Exportar JSON", e um GET direto em `/admin/adequacao/exportar` devolve 403

### Requirement: Cartão na Visão geral
A Visão geral SHALL mostrar, a quem tem `content.edit`, um cartão "Adequação ao Provimento" com "N de 17 seções respondidas" e o botão de continuar; depois do envio, o cartão SHALL dizer "Informações enviadas à Átrios em [data]".

#### Scenario: Cartão reflete o progresso
- **WHEN** 9 seções estão concluídas
- **THEN** o cartão mostra "9 de 17 seções respondidas" e "Continuar de onde parei"
