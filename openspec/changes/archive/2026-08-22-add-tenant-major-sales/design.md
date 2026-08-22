## Context

Registrar uma serventia na Veridia é escrever um arquivo de configuração validado por
`TenantSchema` e adicioná-lo ao registro em `resolve.ts`. Foi assim com Marinho (piloto),
Aurora (fictício) e Bom Jesus. Major Sales segue o mesmo caminho, com uma diferença: não
existe site oficial do cartório de onde tirar os dados, e as bases públicas (Gazeta do Povo,
Sistema Federal, cartorio.net.br) divergem entre si em endereço, telefone e horário.

Confirmado: CNS 09.507-5, ofício único do município de Major Sales / RN. Informado pelo
responsável do projeto: domínio `cartoriomajorsales.com.br`, telefone/WhatsApp
(84) 3190-0980, e-mail `contato@cartoriomajorsales.com.br`, titular Patrícia Magna de
Oliveira (a confirmar), DPO com caixa própria ainda a ser criada.

## Goals / Non-Goals

**Goals**
- Servir o site público e o painel de Major Sales por host próprio, sem código específico.
- Registrar só o que está confirmado; deixar o resto explicitamente marcado como pendente.

**Non-Goals**
- Mudar schema, gating, banco ou qualquer comportamento compartilhado.
- Subir marca, foto de hero, endereço, Pix ou criar contas de admin.

## Decisions

**1. Sem endereço.** As três fontes públicas dão ruas diferentes. `address` é opcional no
schema e a página de contato simplesmente omite o cartão de mapa. Registrar um endereço
errado é pior que não ter: manda o cidadão ao lugar errado. Alternativa descartada: adotar a
fonte da Gazeta do Povo (mais próxima da base do CNJ) — ainda assim um palpite.

**2. Todas as seis atribuições.** Ofício único acumula RCPN, NOTAS, RI, PROTESTO, RTD e RCPJ,
o que as bases públicas confirmam para Major Sales. O gating por atribuição decide o resto.

**3. Tema `vinho-perola`.** Nenhum tenant usa esse tema hoje (Marinho e Bom Jesus usam
`verde-dourado`, Aurora usa `marinho-bronze`). É provisório até o cartório escolher; trocar é
mudar uma string.

**4. Titular com status `a confirmar`.** Mesmo padrão de Bom Jesus: o nome entra, mas a
situação da delegação não foi checada no CNJ Justiça Aberta.

**5. DPO em caixa própria (`dpo@cartoriomajorsales.com.br`).** A LGPD (art. 41 §3) exige canal
institucional. A caixa ainda não existe — vai ser criada junto com o domínio, no mesmo passo
do `emailFrom`. Alternativa descartada: apontar o DPO para o e-mail geral de contato — some
com o canal exigido por lei dentro do atendimento comum.

**6. Placeholders marcados com `ponytail:`.** Logos e horário de atendimento entram com valor
provisório e comentário, como já se fez em Bom Jesus. Sem hero image: o schema a torna
opcional e o gradiente é um hero pior, nunca quebrado.

## Risks / Trade-offs

- **Horário de atendimento incerto** (fontes dizem 7h–17h, 8h–17h e 9h–17h) → entra
  8h–17h com comentário `ponytail:`; afeta a linha "Aberto agora" e a disponibilidade do chat,
  ambas corrigíveis com uma edição.
- **Domínio ainda sem DNS e sem verificação no Postmark** → até verificar, o envio cai no
  remetente da plataforma (`src/lib/email/send.ts`), que é o comportamento já previsto.
- **`issRate` 0,05 assumido** → alíquota municipal de ISS precisa de confirmação antes de
  cobrar; marcado com `ponytail:`, igual a Bom Jesus.

## Migration Plan

Deploy único, sem migração de banco. Rollback é remover a linha do registro. Nenhum tenant
existente é tocado: o `HOST_MAP` é derivado do registro e ganha só as duas entradas novas.

## Open Questions

- Endereço, horário real e alíquota de ISS do município.
- Logos e foto do cartório.
- Situação da delegação da titular no CNJ Justiça Aberta.
