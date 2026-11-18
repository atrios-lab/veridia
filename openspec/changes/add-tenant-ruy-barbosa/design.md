## Context

Registrar uma serventia na Veridia é escrever um arquivo de configuração validado por
`TenantSchema` e adicioná-lo ao registro em `resolve.ts`. Ruy Barbosa segue o mesmo caminho.

Ruy Barbosa / RN é município de ofício único: o Ofício Único de Ruy Barbosa (CNS 09.477-1). Os
dados vêm do próprio cadastro do CNJ no Justiça Aberta (justicaaberta.cnj.jus.br/
produtividade-serventia-extrajudicial/094771), lido em 17/11/2026: é o registro que a serventia
declara e mantém. O Sistema Federal, único agregador achado, está desatualizado (traz outro
titular "respondendo", outro telefone e outro horário) e não foi usado.

Confirmado pelo responsável do projeto: o domínio `cartorioruybarbosarn.com.br` já está
registrado e é o que a serventia vai usar.

## Goals / Non-Goals

**Goals:**
- Servir o site público e o painel de Ruy Barbosa por host próprio, sem código específico.
- Registrar o que consta no cadastro do CNJ; deixar o resto marcado como pendente com
  comentário `ponytail:`.

**Non-Goals:**
- Mudar schema, gating, banco ou qualquer comportamento compartilhado.
- Subir marca, foto de hero ou chave Pix; criar contas de admin, DNS, domínio na Vercel ou
  verificação no Postmark.

## Decisions

**1. Endereço entra.** O CNJ declara Rua Conjunto Novo, 02, Centro, CEP 59420-000. A página de
contato ganha o cartão de mapa e a rota "Como chegar".

**2. Todas as seis atribuições.** O cadastro do CNJ lista RCPN, notas, imóveis, títulos e
documentos, pessoas jurídicas e protesto.

**3. Horário com intervalo, como o CNJ declara.** "Seg - Sex: 08:00-12:00 e 13:00-16:00":
`openingHours` carrega o texto e `counterHours` o intervalo, como em Macaíba. Marcado `ponytail:`.

**4. Um só telefone.** O CNJ traz apenas o fixo (84) 4042-0591; entra como `phone` e `whatsapp`.
A lista oficial do RN traz um celular em nome da titular, (84) 98873-9418, que é mais provável
de ser WhatsApp, mas vem de outra fonte. Marcado `ponytail:`.

**5. Contato institucional no domínio novo.** `contato@cartorioruybarbosarn.com.br` e DPO em
`dpo@cartorioruybarbosarn.com.br`, mesma regra das demais: o Hotmail do cadastro do CNJ não é
institucional. As caixas ainda não existem; a LGPD (art. 41 §3) exige o canal de DPO, então ele
entra antes da caixa existir.

**6. `emailFrom` fica de fora.** Um From em domínio que o Postmark não verificou é recusado,
enquanto o remetente da plataforma entrega.

**7. Titular com status `a confirmar`.** O CNJ marca Patrícia Morais Monte Florêncio como
titular, delegação "provido", desde 15/07/2024. Uma resolução do TJRN de março de 2025 (que
reúne temporariamente a serventia de Lagoa de Velhos a esta) chama a delegatária de
"interventora", status que o schema não tem. Fica "a confirmar" até a serventia dizer.

**8. Receita do Justiça Aberta.** 1º semestre de 2026: R$ 347.722,18; 2º semestre de 2025:
R$ 468.414,94, lidos no portal público em 17/11/2026. Ponto de partida da Seção 1 do módulo de
adequação, que a serventia confirma ou corrige.

**9. Tema `vinho-perola`.** Escolha de partida, já usada por Major Sales e Santa Cruz; nenhuma
regra exige tema único por tenant. Trocar é mudar uma linha.
