## Context

Registrar uma serventia na Veridia é escrever um arquivo de configuração validado por
`TenantSchema` e adicioná-lo ao registro em `resolve.ts`. Cruzeta segue o mesmo caminho.

Cruzeta / RN é município de ofício único: o Ofício Único de Cruzeta (CNS 09.554-7). Os dados vêm
do próprio cadastro do CNJ no Justiça Aberta (justicaaberta.cnj.jus.br/
produtividade-serventia-extrajudicial/095547), lido em 20/11/2026: é o registro que a serventia
declara e mantém.

Confirmado pelo responsável do projeto: o domínio `cartoriocruzetarn.com.br` é o que a serventia
vai usar.

## Goals / Non-Goals

**Goals:**
- Servir o site público e o painel de Cruzeta por host próprio, sem código específico.
- Registrar o que consta no cadastro do CNJ; deixar o resto marcado como pendente com
  comentário `ponytail:`.

**Non-Goals:**
- Mudar schema, gating, banco ou qualquer comportamento compartilhado.
- Subir marca, foto de hero ou chave Pix; criar contas de admin, DNS, domínio na Vercel ou
  verificação no Postmark.

## Decisions

**1. Endereço entra.** O CNJ declara Rua João Lopes de Araújo, 215, Centro, CEP 59375-000. A
página de contato ganha o cartão de mapa e a rota "Como chegar".

**2. Todas as seis atribuições.** O cadastro do CNJ lista RCPN, notas, protesto, imóveis, títulos
e documentos e pessoas jurídicas.

**3. Horário com intervalo, como o CNJ declara.** "Seg - Sex: 08:00-12:00 e 14:00-17:00":
`openingHours` carrega o texto e `counterHours` o intervalo de 12h às 14h, como em Brejinho e
Canguaretama. Marcado `ponytail:`.

**4. Um só telefone.** O CNJ traz apenas o celular (84) 99111-6958; entra como `phone` e
`whatsapp`. A lista oficial do RN traz outro celular em nome da titular, (84) 99408-8998.
Marcado `ponytail:`.

**5. Contato institucional no domínio novo.** `contato@cartoriocruzetarn.com.br` e DPO em
`dpo@cartoriocruzetarn.com.br`, mesma regra das demais: o Gmail do cadastro do CNJ não é
institucional. As caixas ainda não existem; a LGPD (art. 41) exige o canal de DPO, então ele
entra antes da caixa existir.

**6. `emailFrom` fica de fora.** Um From em domínio que o Postmark não verificou é recusado,
enquanto o remetente da plataforma entrega.

**7. Titular `provido`.** O CNJ marca Ivanka Franci Delgado Dantas Nobre Costa como titular,
delegação "provido", desde 15/07/2024. A lista oficial do RN confirma o status de titular. Ela é
também a encarregada (DPO) de partida.

**8. Receita do Justiça Aberta.** 1º semestre de 2026: R$ 902.698,53; 2º semestre de 2025:
R$ 913.404,37, lidos no portal público em 20/11/2026. Ponto de partida da Seção 1 do módulo de
adequação, que a serventia confirma ou corrige.

**9. Tema `oliva-terracota`.** Escolha de partida, já usada por outras serventias; nenhuma regra
exige tema único por tenant. Trocar é mudar uma linha.
