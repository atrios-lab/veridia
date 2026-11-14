## ADDED Requirements

### Requirement: Processo de habilitação preenchido uma vez
O painel DEVE (SHALL) manter, em Registro Civil › Habilitação de casamento, um processo por casal,
com número anual da serventia, para casamento civil, casamento religioso com efeito civil ou
conversão de união estável em casamento. Os dados dos nubentes, do regime de bens, das testemunhas,
do edital, do certificado e da celebração DEVEM (SHALL) ser digitados uma vez, e a variação do caso
(procurador, quem não sabe assinar, menor com autorização, casamento anterior, pacto, separação
obrigatória) DEVE (SHALL) ser escolha nos campos, não um modelo diferente. Os nubentes NÃO DEVEM
(SHALL NOT) ser chamados de "noivo" e "noiva": são "1º nubente" e "2º nubente", e as palavras só
concordam com o sexo quando ele é declarado.

#### Scenario: Abrir com o que tiver
- **WHEN** a serventia abre um processo só com os nomes
- **THEN** o processo recebe o próximo número do ano e mostra em "O que falta" o que precisa antes do edital e do certificado

#### Scenario: Nubentes do mesmo sexo
- **WHEN** os dois nubentes declaram o mesmo sexo
- **THEN** todos os documentos saem com "1º nubente" e "2º nubente" e as palavras concordam com cada um

### Requirement: Conferência da lei antes do certificado
O processo DEVE (SHALL) apontar como pendência: nubente com menos de 16 anos (CC, art. 1.520);
entre 16 e 18 anos sem autorização ou suprimento (arts. 1.517 e 1.519); divorciado, viúvo ou com
casamento anulado sem o documento do fim do casamento anterior (art. 1.525, V); regime diferente
da comunhão parcial e da separação obrigatória sem pacto antenupcial (arts. 1.640 e 1.653);
separação obrigatória sem o motivo (art. 1.641); falta de testemunha (art. 1.525, III); celebração
marcada depois dos 90 dias (art. 1.532). DEVE (SHALL) avisar, sem travar, das causas suspensivas
de viúvo e divorciado (art. 1.523) e do nubente maior de 70 anos (art. 1.641, II, e STF, Tema 1.236).

#### Scenario: Menor sem autorização
- **WHEN** um nubente tem 17 anos e o campo de autorização está vazio
- **THEN** o processo lista a pendência e o certificado não pode ser extraído

### Requirement: Edital no conteúdo do Código Nacional de Normas
O edital de proclamas, no papel e no site, DEVE (SHALL) conter tão somente o nome, o estado civil,
a filiação e a cidade e circunscrição do domicílio de cada nubente (CNN, art. 122), com a menção
de conversão de união estável quando for o caso (LRP, art. 70-A, § 1º). Profissão, idade, data de
nascimento, documento, CPF e endereço NÃO DEVEM (SHALL NOT) ir para o edital. O painel DEVE (SHALL)
publicar o edital nos proclamas do site com um clique, uma vez por processo, e registrar a data.

#### Scenario: Publicar no site
- **WHEN** a serventia clica em "Publicar o edital no site"
- **THEN** o edital entra nos proclamas, o processo guarda a publicação e a data do edital, e o histórico e a auditoria registram o ato

### Requirement: Prazos do certificado e da eficácia
O processo DEVE (SHALL) mostrar o prazo para extrair o certificado (até 5 dias da publicação, LRP,
art. 67, § 1º) e, depois de extraído, até quando a habilitação vale (90 dias, CC, art. 1.532),
contados em dias corridos. A lista DEVE (SHALL) destacar os processos com prazo perto do fim. Na
conversão de união estável não há certificado: o passo seguinte é o assento no Livro B (LRP,
art. 70-A, §§ 3º e 4º).

#### Scenario: Habilitação perto de vencer
- **WHEN** faltam 10 dias ou menos para o fim da eficácia
- **THEN** a lista de habilitações mostra o processo em "Prazos perto do fim"

### Requirement: Documentos do processo
O painel DEVE (SHALL) gerar em PDF, com texto próprio escrito a partir da lei: o requerimento e a
declaração dos nubentes, a declaração das testemunhas, o edital, a certidão de proclamas e o
certificado de habilitação (no religioso, certidão de habilitação, com o prazo de 90 dias para o
registro, CC, art. 1.516, § 1º). Cada um DEVE (SHALL) poder ser assinado digitalmente ou impresso;
quem não sabe assinar tem a assinatura a rogo e o quadro da impressão digital. O documento que
ainda não pode sair DEVE (SHALL) dizer por quê.

#### Scenario: Certidão antes do edital
- **WHEN** o edital ainda não foi publicado
- **THEN** a certidão de proclamas e o certificado não são oferecidos, com a explicação

### Requirement: Alterar, cancelar e estornar sem apagar
Todo campo do processo DEVE (SHALL) poder ser alterado com justificativa, guardando cada campo como
era e como ficou. O cancelamento DEVE (SHALL) marcar o processo, com quem, quando e por quê, sem
apagar, e poder ser estornado. Cada ato DEVE (SHALL) ir para a auditoria. A permissão "Registro
Civil: habilitação de casamento" DEVE (SHALL) aparecer em Perfis e permissões.

#### Scenario: Cancelado não muda
- **WHEN** alguém tenta alterar um processo cancelado
- **THEN** o painel recusa e pede o estorno antes
