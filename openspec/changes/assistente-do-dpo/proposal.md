## Why

A serventia precisa ter um encarregado (DPO) que conheça a LGPD, o Provimento CN 213/2026 (com as
alterações dos Provimentos 214 e 243) e o que a ANPD e a CGJ-RN publicam. Quem assume o papel
é alguém da própria equipe, sem formação jurídica em proteção de dados. As dúvidas aparecem no
dia a dia: o que o titular pode pedir, quando negar e com que fundamento, como responder à ANPD,
o que falta na adequação. Hoje essa pessoa só pode recorrer ao curso e ao suporte da Átrios.

Esta change dá a toda serventia um assistente de IA dentro do painel, **restrito à proteção de
dados e ao papel do encarregado**. Ele responde com base em um conjunto de normas selecionado e
mantido pela Átrios, cita o artigo de onde tirou cada resposta e nunca recebe dados pessoais.

## What Changes

- Nova entrada **"DPO"** na barra lateral do painel, em um grupo novo "Proteção de dados", com
  duas telas: a conversa com o assistente e a lista das conversas da própria pessoa.
- **Assistente restrito ao tema.** Toda pergunta passa primeiro por uma triagem. Se estiver fora
  de proteção de dados, recebe uma recusa padrão e não chega ao modelo principal. As respostas
  se apoiam em uma **base de normas selecionada** (LGPD, Provimento 213 consolidado, Código
  Nacional de Normas, resoluções da ANPD, atos da CGJ-RN), citam a fonte e, quando a base não
  cobre a pergunta, dizem isso em vez de inventar.
- **Contexto da serventia, sem dado pessoal.** O assistente conhece a classe e a subclasse da
  serventia, os prazos da Etapa 1 e da conclusão, a quantidade de pendências da Adequação ao
  Provimento e a quantidade de requerimentos LGPD abertos e próximos do prazo.
- **Rascunho de documentos com marcadores.** O assistente redige respostas ao titular,
  justificativas de negativa, comunicações à ANPD e outros textos usando marcadores
  (`[TITULAR]`, `[PROTOCOLO]`) no lugar de qualquer dado pessoal.
- **"Rascunhar resposta" no requerimento LGPD.** No detalhe do requerimento, um botão pede ao
  assistente um rascunho. Ao modelo vai **só o tipo do pedido** (acesso, correção, exclusão,
  outro). Os marcadores são trocados pelos dados reais **no servidor da plataforma**, e o
  rascunho entra no campo de resposta para a pessoa revisar. Nada é enviado ao titular sem a
  ação dela.
- **Dados pessoais não saem da plataforma.**
  - Um aviso fixo pede que a pessoa não escreva nomes nem documentos.
  - Se escrever mesmo assim, o servidor oculta CPF, CNPJ, RG, CNH, título de eleitor, PIS/NIS,
    CNS, matrícula do registro civil, e-mail, telefone, CEP, endereço e data de nascimento
    **antes** de chamar o modelo e **antes** de gravar.
  - O texto original não é gravado nem registrado em log. A pessoa vê o que foi ocultado.
- **Incluído para todas as serventias, com limite de uso.**
  - Teto mensal por serventia: 300 perguntas, contadas no fuso America/Fortaleza e ajustáveis
    pela Átrios.
  - Limite de ritmo por pessoa.
  - Recusas por estar fora do tema não consomem o teto.
- **Quem usa.** Uma permissão própria, `dpo.assist`, ligada por padrão para todos os cargos do
  painel (deriva de `desk.access`). O Tabelião/Registrador pode retirá-la em Perfis e
  permissões. O aluno do curso (`learner`) não tem acesso.
- **Supervisão da Átrios.**
  - Dentro da serventia, cada pessoa vê só as próprias conversas.
  - A Átrios (superadmin) vê as conversas de todas as serventias, o uso do mês e o teto de cada
    uma.
  - A tela do assistente avisa que as conversas ficam visíveis à equipe de suporte da plataforma. O nome da Átrios não aparece em nenhum texto que a serventia vê (decisão de 15/11/2026).
- **Guarda por 12 meses.** Cada conversa é apagada 12 meses depois da última mensagem.
- Dependências novas: AI SDK e Vercel AI Gateway (com retenção zero de dados no provedor).

## Non-goals

- **Gerar PDF e assinar.** Nesta change os documentos saem como texto para revisar e copiar.
  Gerar PDF com `pdfkit` e passar pelo Assinador digital fica para uma change própria.
- **Enviar o conteúdo do requerimento ao modelo.** O texto escrito pelo titular, os anexos e os
  dados de identificação nunca vão. Isso é decisão do usuário (só perguntas genéricas), não uma
  limitação técnica.
- **Responder ao cidadão.** O assistente atende só a equipe da serventia no painel. Nada no site
  público muda.
- **Mover para o grupo novo** "Requerimentos LGPD", "Adequação ao Provimento" e "Encarregado".
  Reorganizar a barra lateral é outra decisão.
- **Busca na internet.** O assistente não consulta páginas externas: o que não está na base, ele
  diz que não encontrou.
- **Ocultar nomes próprios com garantia.** Uma regra local não separa com segurança
  "Maria da Silva" de "Registro Civil". Nomes ficam cobertos pelo aviso e pelas instruções do
  modelo. A limitação fica documentada.
- **Parecer jurídico.** O assistente orienta. A decisão e a assinatura continuam sendo do
  encarregado, e a tela diz isso.
- **Plano comercial ou cobrança por uso.** O assistente está incluído. O teto controla custo,
  não é produto.

## Capabilities

### New Capabilities

- `dpo-assistant`: a conversa com o assistente no painel. Cobre acesso e permissão, restrição ao
  tema, base de normas e citação, contexto da serventia, rascunho com marcadores, ocultação de
  dados pessoais, limites de uso, histórico da pessoa e guarda de 12 meses.
- `dpo-assistant-oversight`: a área da Átrios. Cobre a leitura das conversas de todas as
  serventias, o uso do mês e o ajuste do teto por serventia.

### Modified Capabilities

- `data-rights-channel`: o detalhe do requerimento no painel ganha "Rascunhar resposta", que
  manda ao assistente só o tipo do pedido e preenche os marcadores na plataforma.

## Impact

- **Núcleo** (`src/core/dpo/`):
  - ocultação de dados pessoais (regras puras com testes extensos, inclusive de falso positivo);
  - troca dos marcadores;
  - contagem do teto mensal;
  - prazo de guarda;
  - montagem do contexto da serventia.
- **Base de normas:** textos versionados no repositório, divididos por dispositivo, com data de
  atualização. A busca é feita em memória, no núcleo.
- **Banco:** migração aditiva com tabelas de conversa, mensagem, uso mensal e teto por
  serventia.
- **Rotas:**
  - `/admin/dpo` e `/admin/dpo/conversas` no painel;
  - `/admin/atrios/assistente-dpo` na área da Átrios;
  - um Route Handler com resposta em streaming na própria origem (a CSP continua
    `connect-src 'self'`);
  - o expurgo de 12 meses entra na rotina diária que já existe (`/api/agenda/lembretes`), sem
    cron novo.
- **Permissões:** `dpo.assist` em `OFFICE_PERMISSIONS`, `GRANTABLE_PERMISSIONS` e
  `DERIVED_FROM` (de `desk.access`), com rótulo em Perfis e permissões.
- **Navegação:** grupo "Proteção de dados" e item "DPO" em `nav.ts`.
- **Requerimento LGPD:** `lgpd/[protocolo]/_components/reply-section.tsx` ganha o botão de
  rascunho.
- **Pacotes e ambiente:**
  - pacotes `ai` (AI SDK);
  - variável do AI Gateway em Produção e Preview.
  - Sem a variável (desenvolvimento local), a tela diz que o assistente está indisponível neste
    ambiente.
- **Documentos legais:** a política de privacidade da plataforma passa a citar o uso de um
  provedor de IA (sem dado pessoal, com retenção zero). O inventário de tratamento da Átrios
  ganha a linha correspondente.
