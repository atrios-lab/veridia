## Context

Mesma rotina de Marinho, Aurora, Bom Jesus e Major Sales: um arquivo de configuração validado
por `TenantSchema`, adicionado ao registro em `resolve.ts`.

**Taipu** (CNS 09.377-3): fontes públicas (Gazeta do Povo, Sistema Federal) concordam entre si
— titular Selma Teixeira de Menezes, endereço Rua Salvina Soares de Miranda, 11-B, Centro,
Taipu/RN, 59565-000, atendimento 8h–12h e 14h–17h. Telefone informado pelo responsável do
projeto: (84) 4042-0593 (diverge do telefone público 3264-2477, tratado como o número
institucional atual).

**Bento Fernandes** (CNS 09.502-6): titular Gladis Rosane Schmidt confirmada em duas fontes.
Telefone informado, (84) 4042-0779, bate exatamente com o valor público (Sistema Federal) — alta
confiança. Endereço diverge entre fontes (Av. Duque de Caxias, 407 vs. Rua Dom Pedro I, 94), e o
domínio próprio (`cartoriobentofernandesrn.com.br`, confirmado pelo responsável do projeto) já é
usado pelo cartório em `cartoriobentofernandes.com.br`, achado durante a pesquisa.

## Goals / Non-Goals

**Goals**
- Servir as duas serventias por host próprio, sem código específico.
- Registrar só o que está confirmado; deixar o resto marcado como pendente.

**Non-Goals**
- Mudar schema, gating, banco ou qualquer comportamento compartilhado.
- Subir marca, foto de hero, endereço (Bento Fernandes) ou Pix.

## Decisions

**1. Endereço só para Taipu.** As fontes concordam para Taipu; divergem para Bento Fernandes
(ruas diferentes, mesmo CEP). Mesma regra aplicada a Major Sales: endereço incerto é pior que
nenhum endereço — a página de contato simplesmente omite o cartão de mapa.

**2. Todas as seis atribuições nos dois.** Ambos são ofício único; as fontes públicas listam
Notas, RCPN, RI, Protesto e registro de documentos/pessoas jurídicas para os dois.

**3. Temas ainda não usados.** `grafite-cobre` para Taipu, `oliva-terracota` para Bento
Fernandes — nenhum tenant registrado usa esses dois hoje.

**4. Titular com status `a confirmar`** nos dois, mesmo padrão de Bom Jesus e Major Sales:
nome confirmado nas fontes públicas, delegação não checada no CNJ Justiça Aberta.

**5. Contato institucional no domínio novo, não no e-mail público antigo.** Mesma decisão de
Major Sales: `contato@` e `nao-responda@` no domínio próprio de cada serventia, não no
Hotmail/domínio antigo achado na pesquisa. DPO em caixa própria (`dpo@...`), ainda a ser criada.

**6. `issRate` 0.05 assumido** para os dois, sem fonte municipal — marcado `ponytail:`.

## Risks / Trade-offs

- **Horário de Taipu com intervalo de almoço** (8h–12h, 14h–17h) é diferente do padrão contínuo
  (`counterHours` só guarda início/fim); `counterHours` registra 8h–17h e o texto livre de
  `openingHours` carrega o horário real com o intervalo — mesma solução usada sempre que o
  campo estruturado não captura a nuance, o texto é o que o cidadão lê.
- **Domínios ainda sem DNS nem verificação no Postmark** → e-mail cai no remetente da
  plataforma até isso ser feito.
- **`issRate` assumido nos dois** → alíquota municipal real precisa de confirmação antes de
  cobrar.

## Migration Plan

Deploy único, sem migração de banco. Rollback é remover as duas linhas do registro.

## Open Questions

- Endereço real de Bento Fernandes, horário exato e alíquota de ISS dos dois municípios.
- Logos e foto de cada cartório.
- Situação da delegação das duas titulares no CNJ Justiça Aberta.
