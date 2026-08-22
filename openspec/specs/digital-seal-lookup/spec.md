# digital-seal-lookup

## Purpose
Consulta do selo digital do TJRN feita dentro do site da serventia, na identidade do tenant: o cidadão digita o código do selo e resolve o captcha do próprio TJ, e o resultado é renderizado na página. Cobre o transporte da sessão do TJ no cookie do cidadão (sem estado no servidor), a degradação honesta com link permanente para a consulta oficial quando o TJ falha, o aviso de conferência simples junto ao resultado e a proteção da rota contra abuso.

## Requirements

### Requirement: Consulta do selo dentro do site com captcha do TJ resolvido pelo cidadão
`/selo` DEVE (SHALL) oferecer a consulta do selo digital do TJRN na identidade da serventia:
campo de código do selo (aceitando vários códigos separados por `;`, repassados como digitados),
a imagem do captcha da sessão do TJ com ação "gerar novo código", e o resultado renderizado na
própria página. O captcha DEVE (SHALL) ser sempre resolvido pelo cidadão; o sistema NÃO DEVE
(SHALL NOT) resolver, contornar ou cachear captcha por nenhum meio. A página DEVE (SHALL)
permanecer atrás do gating da seção `selo-tjrn`.

#### Scenario: Consulta bem-sucedida
- **WHEN** o cidadão informa um código de selo válido e o texto correto do captcha
- **THEN** o resultado retornado pelo TJ aparece na página, na identidade visual do tenant, sem redirecionamento

#### Scenario: Captcha errado vira mensagem clara
- **WHEN** o TJ responde que o texto não corresponde à imagem
- **THEN** a página exibe a mensagem em linguagem clara e oferece gerar novo código, preservando o código do selo digitado

#### Scenario: Gerar novo código renova a sessão
- **WHEN** o cidadão pede um novo código
- **THEN** uma nova imagem de captcha (de sessão nova do TJ) substitui a anterior

### Requirement: Sessão do TJ viaja no cookie do cidadão, sem estado no servidor
A sessão aberta no TJ para exibir o captcha DEVE (SHALL) ser transportada exclusivamente num
cookie HttpOnly do cidadão (`secure`, caminho restrito a `/selo`, expiração curta). O servidor
NÃO DEVE (SHALL NOT) guardar mapeamento de sessão em banco, Redis ou memória. A submissão DEVE
(SHALL) reutilizar a mesma sessão do cookie; cookie ausente ou sessão expirada DEVE (SHALL)
resultar em orientação para gerar novo código, nunca em erro genérico.

#### Scenario: Submissão sem cookie
- **WHEN** a consulta é submetida sem o cookie de sessão (expirado ou bloqueado)
- **THEN** a página orienta a gerar um novo código de imagem, sem stack trace nem erro 500

#### Scenario: Imagem do captcha não é cacheada
- **WHEN** a rota da imagem do captcha responde
- **THEN** a resposta proíbe cache (`no-store`), pois a imagem só vale para a sessão do cookie que a acompanha

### Requirement: Falha do TJ degrada com honestidade e fallback permanente
A página DEVE (SHALL) exibir permanentemente o link para a consulta oficial no site do TJ. Quando
o TJ não responder no tempo limite, responder erro, ou devolver markup que o parser não
reconhece, a página DEVE (SHALL) mostrar um card de indisponibilidade apontando o link oficial —
nunca inventar resultado, nunca mostrar erro técnico cru. O parse DEVE (SHALL) tratar markup
não reconhecido como resultado de primeira classe (`unrecognized`), não como exceção.

#### Scenario: TJ fora do ar
- **WHEN** a requisição ao TJ excede o tempo limite ou falha
- **THEN** o card de indisponibilidade aparece com o link para a consulta oficial e os contatos da serventia seguem visíveis no site

#### Scenario: Markup mudou
- **WHEN** o TJ responde 200 com HTML que o parser não reconhece
- **THEN** a página exibe o card de indisponibilidade com o link oficial, sem dado parcial nem inventado

#### Scenario: Link oficial sempre presente
- **WHEN** a página `/selo` renderiza, com ou sem resultado
- **THEN** o link para a consulta oficial do TJ está visível

### Requirement: Aviso de conferência simples
O resultado da consulta DEVE (SHALL) vir acompanhado de aviso fixo: as informações são para
simples conferência, não substituem o documento original, e dúvidas devem ser tratadas com o
cartório emissor do ato.

#### Scenario: Aviso junto ao resultado
- **WHEN** um resultado de consulta é exibido
- **THEN** o aviso de conferência simples aparece junto dele

### Requirement: Proteção da rota contra abuso
A rota da imagem do captcha e a submissão da consulta DEVEM (SHALL) ter rate limit próprio por
endereço, no padrão da plataforma (desligado quando o Upstash não está configurado, obrigatório
em produção). A submissão DEVE (SHALL) fazer no máximo uma tentativa contra o TJ por envio do
cidadão, sem retry automático.

#### Scenario: Enxurrada de consultas
- **WHEN** um mesmo endereço excede o limite por minuto
- **THEN** a resposta orienta aguardar, e nenhuma requisição é feita ao TJ

#### Scenario: Sem retry automático
- **WHEN** a submissão ao TJ falha
- **THEN** o sistema não reenvia sozinho; o cidadão decide tentar de novo com novo captcha
