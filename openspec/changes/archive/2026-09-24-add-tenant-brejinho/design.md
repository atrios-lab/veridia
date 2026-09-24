## Context

Registrar uma serventia na Veridia é escrever um arquivo de configuração validado por
`TenantSchema` e adicioná-lo ao registro em `resolve.ts`. Foi assim com as onze serventias já
registradas. Brejinho segue o mesmo caminho.

Brejinho / RN é município de ofício único: o Ofício Único de Brejinho (CNS 09.553-9). Não foi
encontrado site nem perfil oficial da serventia; os dados vêm dos agregadores que espelham o
cadastro do CNJ (Gazeta do Povo, Sistema Federal, Cartório no Brasil, eCartórios,
cartorio.info), consultados em 24/09/2026. Concordam em titular Antônio Paulino da Silva (em
exercício desde 06/04/2023, segundo o eCartórios; substituta Maria de Fátima Andrade Silva),
endereço Av. Antônio Alves Pessoa, 1008, Centro, 59219-000, e telefone (84) 3283-2071.
Divergem no horário: 7h30–17h (Gazeta), 8h–17h (eCartórios), 8h–12h e 14h–18h (Sistema
Federal e Cartório no Brasil).

Confirmado pelo responsável do projeto: o domínio `cartoriobrejinhorn.com.br` já está
registrado e é o que a serventia vai usar.

## Goals / Non-Goals

**Goals:**
- Servir o site público e o painel de Brejinho por host próprio, sem código específico.
- Registrar só o que está confirmado ou é consenso entre as fontes; deixar o resto marcado como
  pendente com comentário `ponytail:`.

**Non-Goals:**
- Mudar schema, gating, banco ou qualquer comportamento compartilhado.
- Subir marca, foto de hero, chave Pix, `emailFrom` ou `revenue`.
- Criar contas de admin, DNS, domínio na Vercel ou verificação no Postmark.

## Decisions

**1. Endereço entra.** Todas as fontes dão a mesma avenida, número e CEP, como em Canguaretama.
A página de contato ganha o cartão de mapa e a rota "Como chegar".

**2. Todas as seis atribuições.** Ofício único acumula RCPN, NOTAS, RI, PROTESTO, RTD e RCPJ,
o que o cadastro do CNJ confirma.

**3. Horário com intervalo, o que duas fontes compartilham.** Das três versões, "das 8h às 12h
e das 14h às 18h" é a única que se repete. `counterHours` fica 8–18 e o texto de
`openingHours` carrega o intervalo, como em Taipu e Canguaretama. Marcado `ponytail:`;
corrigível com uma edição quando a serventia confirmar.

**4. Um só telefone.** As fontes trazem apenas o fixo (84) 3283-2071; nenhuma publica celular.
Entra como `phone` e `whatsapp`, mesma solução de Major Sales e Canguaretama. Marcado
`ponytail:`.

**5. Contato institucional no domínio novo.** `contato@cartoriobrejinhorn.com.br` e DPO em
`dpo@cartoriobrejinhorn.com.br`, mesma regra de Canguaretama: o e-mail do Yahoo achado nos
agregadores não é institucional. As caixas ainda não existem; a LGPD (art. 41 §3) exige o canal
de DPO, então ele entra antes da caixa existir.

**6. `emailFrom` fica de fora.** Um From em domínio que o Postmark não verificou é recusado,
enquanto o remetente da plataforma entrega. Entra quando o super admin verificar o domínio.

**7. Titular com status `a confirmar`.** Nome unânime nas fontes, delegação não checada no CNJ
Justiça Aberta. Mesmo padrão de todas as serventias reais depois do piloto.

**8. Tema `grafite-cobre`.** Escolhido pelo responsável do projeto, que preferiu o cinza.
Já é usado por Taipu e Tibau do Sul; nenhuma regra exige tema único por tenant. Trocar é mudar
uma string.

**9. Sem `revenue`.** A serventia não consta do levantamento do Justiça Aberta de 10/07/2026.
A Seção 1 da adequação fica em branco e a serventia preenche; ausência nunca se escreve como
zero.

**10. Município "BREJINHO".** Oito caracteres, cabe nos quinze do Merchant City do Pix.

**11. Marca padrão da plataforma.** Logos `selo-padrao-*`, como todas as serventias sem
identidade própria.

## Risks / Trade-offs

- [Horário divergente entre as fontes] → comentário `ponytail:` no arquivo; a serventia
  confirma e a correção é uma edição de string.
- [`issRate` 0,05 assumido] → alíquota municipal precisa de confirmação antes de cobrar;
  marcado `ponytail:`, igual às demais.
- [Domínio registrado, mas sem DNS na Vercel e sem verificação no Postmark] → até lá o host de
  produção não responde e o e-mail sai pelo remetente da plataforma. Ambos são passos do super
  admin, listados no PR.

## Migration Plan

Deploy único, sem migração de banco. Rollback é remover a linha do registro. Nenhum tenant
existente é tocado: o `HOST_MAP` é derivado do registro e ganha só as duas entradas novas.

## Open Questions

- WhatsApp real, horário exato e alíquota de ISS do município.
- Logos e foto do cartório.
- Situação da delegação do titular no CNJ Justiça Aberta.
- Se Brejinho entrar em um próximo levantamento do Justiça Aberta, preencher `revenue`.
