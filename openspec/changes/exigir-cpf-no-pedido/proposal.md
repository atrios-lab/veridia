## Why

O pedido de serviço pode ser protocolado sem CPF, tanto no site quanto no balcão, então a serventia
nem sempre tem um identificador da pessoa que pediu. A serventia solicitou que o CPF passe a ser
obrigatório, e a regra vale para todas as serventias. A finalidade do uso do CPF e uma eventual exigência legal ainda precisam ser informadas
por ela: são a justificativa de necessidade (LGPD art. 6º, III) e estão em aberto no `design.md`.

## What Changes

- **BREAKING** O formulário público do pedido (`/solicitar`) passa a recusar envio sem CPF válido,
  com a mesma validação no cliente e no servidor. Quem não tem CPF é orientado a procurar o balcão.
- **BREAKING** O lançamento manual no balcão passa a exigir CPF válido ou, como exceção explícita,
  a marcação "cidadão não possui CPF" acompanhada de outro documento (RG, RNE, passaporte etc.).
- O outro documento aparece no detalhe do pedido, de forma mascarada, e por completo no requerimento
  impresso.
- A correção de dados do pedido deixa de permitir apagar um CPF já gravado: ele só pode ser trocado
  por outro válido ou substituído pela exceção com outro documento. Pedido antigo sem CPF continua
  corrigível sem que nenhum dado novo seja exigido.
- O e-mail não muda: já é obrigatório no site e o balcão mantém o contato "e-mail ou telefone".

## Não-objetivos

- Oferecer configuração por serventia: a regra é a mesma para todos os tenants.
- Exigir e-mail no balcão: é onde é atendido quem não tem e-mail, e exigir levaria a endereços
  inventados que recebem avisos do pedido.
- Mudar Agendamento, canal LGPD ou Ouvidoria: o CPF segue opcional ou ausente nesses canais.
- Mudar o campo "CPF ou RG" dos beneficiários e assinantes da gratuidade.
- Oferecer no site a exceção de quem não tem CPF: sem um operador conferindo o documento, ela viraria
  uma forma de pular o campo.
- Preencher CPF em pedidos antigos, ou migrar o banco.
- Permitir buscar pedidos pelo outro documento.
- Usar o CPF na recuperação da chave de acesso: pedidos antigos continuam sem ele.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `service-request`: o formulário público passa a exigir CPF e a orientar quem não tem o documento.
- `admin-service-requests`: o lançamento manual exige CPF ou a exceção com outro documento; o detalhe,
  o requerimento e a correção de dados passam a tratar essa exceção; a correção não apaga CPF gravado.

## Impact

- **Núcleo:** `src/core/request/form.ts` (`commonFields`, `publicServiceRequestSchema`,
  `serviceRequestSchema`), `src/core/request/edit.ts`, `src/core/request/kinds.ts` (leitura de
  `details`), `src/core/request/requerimento.ts`.
- **Site:** `src/app/(public)/solicitar/request-form.tsx` e `actions.ts`.
- **Painel:** `src/app/admin/(dashboard)/pedidos/novo/` e
  `src/app/admin/(dashboard)/pedidos/[protocolo]/` (`actions.ts`, `page.tsx`,
  `_components/applicant-section.tsx`).
- **Dados:** sem migração. As colunas `cpf` e `contact` continuam aceitando nulo, porque a tabela
  guarda outros tipos de registro e pedidos antigos; o outro documento fica em `details`.
- **Testes:** `src/core/request/request.test.ts`, `src/core/request/edit.test.ts` e os testes que
  montam pedidos sem CPF.
