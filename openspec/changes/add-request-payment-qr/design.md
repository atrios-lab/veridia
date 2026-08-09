## Context

`amountCents` já existe em `service_requests` e o operador já o define pelo painel
(`AmountSection`, em `/admin/pedidos/[protocolo]`). A mudança que introduziu esse campo
(`add-admin-service-requests`) deixou explícito, como não-objetivo, que o cidadão não veria esse
valor: "Exibir o valor ao cidadão ou gerar cobrança Pix — só o operador informa; a exibição fica
pra depois." Este design é esse "depois".

A serventia também já pode cadastrar uma chave Pix (`/admin/configuracoes/cobranca`,
`src/core/tenant/pix.ts`), mas hoje essa chave só é guardada — nada a lê para gerar cobrança. A
spec já pendente dessa tela (`add-billing-and-dpo-settings`, ainda não arquivada) já antecipa o
comportamento que este design implementa: "sem chave, a consulta de protocolo não exibe QR Code e
o cidadão vê apenas o valor e a instrução de pagar no balcão."

Não existe, em lugar nenhum da plataforma, um campo de cidade da serventia. O padrão Pix (Banco
Central, Manual de Padrões para Iniciação do Pix) exige um campo Merchant City no payload "Copia e
Cola", então este design precisa introduzi-lo.

## Goals / Non-Goals

**Goals:**
- Quando um pedido tem `amountCents` definido, a consulta pública de protocolo (com ou sem a
  chave de acesso) exibe esse valor.
- Quando, além do valor, a serventia tem chave Pix e cidade cadastradas, a mesma tela exibe um QR
  code Pix com o valor já fixado, mais o código "Copia e Cola" equivalente, com botão de copiar.
- Sem chave Pix (ou sem cidade) cadastrada, a tela mostra o valor e uma instrução textual de pagar
  no balcão — nunca um QR quebrado nem um erro.
- A geração do payload Pix (EMV/BR Code) é regra pura em `src/core`, sem I/O e sem depender de
  serviço externo.

**Non-Goals:**
- Confirmação automática de pagamento (webhook do PSP, conciliação bancária, mudança automática
  de "Aguardando pagamento" para "Pago"). A serventia continua conferindo pelo extrato e mudando o
  andamento manualmente, como já declarado na tela de Cobrança hoje.
- Pix dinâmico com endpoint de PSP (campo 26 apontando para uma URL que o banco consulta em tempo
  real). Não há integração com nenhum Provedor de Serviço de Pagamento nesta mudança: o QR gerado
  é um Pix estático com valor fixo, o mesmo tipo que qualquer comércio pequeno imprime.
- Impedir o reuso do mesmo QR para pagar de novo, ou qualquer forma de expiração. É uma limitação
  conhecida do Pix estático (ver Riscos).
- Mudar como o operador define ou edita o valor no painel — isso já está implementado.
- Cobrança parcial, parcelamento, ou moeda diferente de BRL.

## Decisions

### 1. Payload Pix EMV escrito à mão em `src/core`, sem biblioteca

`src/core/payment/pix-charge.ts` (novo) monta o payload TLV (00, 26 com subcampos 00/01, 52, 53,
54, 58, 59, 60, 62 com subcampo 05, 63) e calcula o CRC16-CCITT (polinômio `0x1021`, início
`0xFFFF`) na mão — a mesma disciplina de `src/core/tenant/pix.ts`, que já valida CPF/CNPJ sem
depender de pacote externo. O algoritmo é curto, estável (é um padrão público do Banco Central que
não muda) e evita puxar uma dependência de terceiro para montar uma string.

Alternativa considerada: usar um pacote npm pronto (ex. `pix-utils`, `qrcode-pix`). Rejeitada por
duas razões: (1) regra de negócio pura pertence ao núcleo, não a uma dependência externa
substituível; (2) esses pacotes carregam suposições (formatação de nome do recebedor, limites)
que teriam de ser conferidas mesmo assim — não economizam a leitura da especificação.

- **Ponto de iniciação**: `11` (estático, reutilizável) — não `12` (dinâmico), porque não há PSP
  gerando o payload sob demanda. É a mesma categoria de QR que uma banca de jornal imprime com
  valor fixo.
- **Merchant Name** (campo 59, até 25 caracteres): nome da serventia (`tenant.name`), truncado e
  sem acentos/caracteres fora do alfabeto aceito pelo padrão.
- **Merchant City** (campo 60, até 15 caracteres): novo campo `pix.city`, ver decisão 3.
- **TxID** (campo 62/05, alfanumérico, até 25 caracteres): número do protocolo sem pontuação (ex.
  `REQ.2026.000148` → `REQ2026000148`) — já é único por serventia e por ano, não exige nenhum
  identificador novo.
- **Valor** (campo 54): `amountCents` formatado como `0.00` (duas casas, ponto decimal), conforme
  o padrão exige.

### 2. QR renderizado no servidor com a biblioteca `qrcode`, como SVG inline

O payload textual (regra pura) é transformado em imagem por `qrcode` (pacote npm consolidado, sem
dependências, ~10 anos de uso em produção) chamado num Server Component, gerando SVG inline —
sem JavaScript de cliente, sem `<canvas>`, sem round-trip. Isso é transporte de apresentação, não
regra de negócio: o mesmo espírito de usar Next/Drizzle como "transporte descartável" em volta do
núcleo.

Alternativas consideradas e rejeitadas:
- **Gerar a imagem via serviço externo (API de QR code)**: vazaria o payload (que contém o valor
  e um identificador do pedido) para um terceiro a cada consulta. Inaceitável para um dado
  financeiro do cidadão.
- **Renderizar no cliente com `<canvas>`**: exigiria componente client-side e hidratação para
  algo que é puramente determinístico a partir de dados já carregados no servidor.

### 3. Novo campo obrigatório `pix.city` no `TenantSchema`

Adicionado a `TenantSchema.shape.pix` (`src/core/tenant/schema.ts`), ao lado de `type` e `key`,
com o mesmo tratamento de normalização/validação dos demais campos de `src/core/tenant/pix.ts`:
maiúsculas, sem acento, até 15 caracteres (o limite do próprio padrão Pix). Por já estar dentro do
objeto `pix`, herda automaticamente o comportamento de override em `overrides.ts`
(`OfficePixSchema`/`OfficePixOverrideSchema` derivam de `TenantSchema.shape.pix` via `.pick`) —
**sem migração de banco**, já que `pix` mora no JSONB de `tenant_content`.

A tela `/admin/configuracoes/cobranca` (`pix-key-form.tsx`) ganha o campo "Cidade" junto da chave,
com a mesma permissão (`billing.edit`) e o mesmo texto de ajuda explicando o efeito.

**Retrocompatibilidade**: serventias que já cadastraram chave Pix antes desta mudança não têm
`city`. Trata-se exatamente como "sem chave" para fins de exibição do QR (decisão 4) até que a
serventia preencha o campo — nunca se inventa uma cidade.

### 4. Degradação: valor sempre aparece, QR só com chave *e* cidade

A consulta de protocolo lê o valor do pedido (quando definido) e, separadamente, decide se
consegue montar o payload Pix: precisa de `amountCents`, `tenant.pix.key` e `tenant.pix.city`
simultaneamente. Faltando qualquer um dos três, a tela mostra o valor formatado
(`formatCents`) com o texto "pague no balcão da serventia" — nunca esconde o valor por falta de
QR, e nunca tenta desenhar um QR incompleto.

### 5. Valor e pagamento aparecem mesmo na consulta sem chave de acesso

Diferente de nome do requerente, documentos e exigências (que exigem a chave de acesso), o valor
e o QR de pagamento entram no resumo público "trancado" (`PublicStatus`, sem chave) — é
informação que não identifica ninguém e que quem está prestes a pagar precisa ver sem digitar a
chave de novo. Mantém-se o texto já existente ("nomes, documentos e valores ficam protegidos")
ajustado, já que valor deixa de ser protegido — ver spec delta.

### 6. Reaproveitar `CopyField` para o "Copia e Cola"

O botão de copiar já existe (`src/app/(public)/_components/protocol-reveal.tsx`, `CopyField`) e é
reaproveitado para o código Pix, em vez de escrever um novo componente de clipboard.

## Risks / Trade-offs

- **QR estático pode ser reescaneado e pago mais de uma vez** → Fora do escopo resolver aqui (é a
  mesma limitação que qualquer QR Pix estático tem); a serventia já confere manualmente pelo
  extrato antes de marcar "Pago", então um pagamento duplicado aparece lá, não é silenciosamente
  aceito pelo sistema.
- **Merchant City incorreto invalida o payload em alguns leitores de banco** → Validado no
  servidor com o mesmo rigor dos outros campos de `pix`; testes cobrem o formato exato exigido
  pelo padrão (maiúsculas, sem acento, até 15 caracteres).
- **Serventias com chave já cadastrada ficam sem QR até preencherem a cidade** → Aceito: é
  preferível ao QR incompleto ou a inventar uma cidade. A tela de Cobrança já teria que ser aberta
  de qualquer forma para revisar a chave; o novo campo aparece vazio, obrigatório, no mesmo bloco.
- **CRC16 e montagem do TLV com bug geram QR que nenhum banco lê** → Mitigado com testes unitários
  no núcleo, incluindo comparação com payloads Pix conhecidos e válidos (fixtures), não apenas
  round-trip do próprio código.
