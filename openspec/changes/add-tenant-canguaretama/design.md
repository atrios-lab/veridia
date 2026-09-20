## Context

Registrar uma serventia na Veridia é escrever um arquivo de configuração validado por
`TenantSchema` e adicioná-lo ao registro em `resolve.ts`. Foi assim com as dez serventias já
registradas. Canguaretama segue o mesmo caminho.

Canguaretama / RN é município de ofício único: o Ofício Único de Registros e Notas de
Canguaretama (CNS 09.519-0). Não foi encontrado site nem perfil oficial da serventia; os dados
vêm dos agregadores que espelham o cadastro do CNJ (Gazeta do Povo, cartorio.net.br,
cartorio.info, Sistema Federal, Cartórios do Brasil), consultados em 20/09/2026, e concordam
entre si mais do que o habitual: titular Maria dos Ramos Freire Vieira, endereço Rua André de
Albuquerque, 155, Centro, 59190-000, telefone (84) 3241-2280, atendimento das 8h às 12h e das
14h às 18h.

Confirmado pelo responsável do projeto: o domínio `cartoriocanguaretamarn.com.br` já está
registrado e é o que a serventia vai usar.

## Goals / Non-Goals

**Goals:**
- Servir o site público e o painel de Canguaretama por host próprio, sem código específico.
- Registrar só o que está confirmado ou é consenso entre as fontes; deixar o resto marcado como
  pendente com comentário `ponytail:`.

**Non-Goals:**
- Mudar schema, gating, banco ou qualquer comportamento compartilhado.
- Subir marca, foto de hero, chave Pix, `emailFrom` ou `revenue`.
- Criar contas de admin, DNS, domínio na Vercel ou verificação no Postmark.

## Decisions

**1. Endereço entra.** Todas as fontes dão a mesma rua, número e CEP, ao contrário de Major
Sales e Bento Fernandes, onde divergiam e o endereço ficou de fora. A página de contato ganha o
cartão de mapa e a rota "Como chegar". Alternativa descartada: deixar sem endereço até a
serventia confirmar; com fontes unânimes, omitir tira do cidadão uma informação boa.

**2. Todas as seis atribuições.** Ofício único acumula RCPN, NOTAS, RI, PROTESTO, RTD e RCPJ,
o que o cadastro do CNJ confirma. As interdições e tutelas listadas entram em RCPN, como nos
demais ofícios únicos.

**3. Horário com intervalo, como Taipu.** `counterHours` guarda só início e fim, então fica
8h–18h; o texto de `openingHours` carrega o intervalo real ("das 8h às 12h e das 14h às 18h"),
que é o que o cidadão lê. A linha "Aberto agora" e a disponibilidade do chat vão considerar o
balcão aberto entre 12h e 14h; corrigível com uma edição quando a serventia confirmar.

**4. Um só telefone.** As fontes trazem apenas o fixo (84) 3241-2280; nenhuma publica celular.
Entra como `phone` e `whatsapp`, mesma solução de Major Sales. Marcado `ponytail:` para a
serventia informar o WhatsApp real.

**5. Contato institucional no domínio novo.** `contato@cartoriocanguaretamarn.com.br` e DPO em
`dpo@cartoriocanguaretamarn.com.br`, mesma regra de Major Sales, Taipu e Bento Fernandes: o
e-mail achado nos agregadores não é institucional. As caixas ainda não existem; a LGPD (art. 41
§3) exige o canal de DPO, então ele entra antes da caixa existir. Alternativa descartada: usar o
e-mail dos agregadores, como Tibau e Mipibu fizeram; ali não havia domínio próprio confirmado,
aqui há.

**6. `emailFrom` fica de fora.** Mesmo motivo de Tibau e Mipibu: um From em domínio que o
Postmark não verificou é recusado, enquanto o remetente da plataforma entrega. Entra quando o
super admin verificar o domínio.

**7. Titular com status `a confirmar`.** Nome unânime nas fontes, delegação não checada no CNJ
Justiça Aberta. Mesmo padrão de todas as serventias reais depois do piloto.

**8. Tema `marinho-bronze`.** Os cinco temas já têm dois tenants cada; não há mais tema virgem.
`marinho-bronze` é usado por Aurora, que é fictícia, então entre as serventias reais é o menos
repetido. Provisório até o cartório escolher; trocar é mudar uma string.

**9. Sem `revenue`.** A serventia não consta do levantamento do Justiça Aberta de 10/07/2026. A
Seção 1 da adequação fica em branco e a serventia preenche; ausência nunca se escreve como zero.

**10. Município "CANGUARETAMA".** Doze caracteres, cabe nos quinze do Merchant City do Pix sem
abreviar.

**11. Marca padrão da plataforma.** Logos `selo-padrao-*`, como todas as serventias sem
identidade própria; a serventia troca em Identidade Visual.

## Risks / Trade-offs

- [Horário e telefone só de agregadores] → comentários `ponytail:` no arquivo; a serventia
  confirma e a correção é uma edição de string.
- [`issRate` 0,05 assumido] → alíquota municipal precisa de confirmação antes de cobrar;
  marcado `ponytail:`, igual às demais.
- [Domínio registrado, mas sem DNS na Vercel e sem verificação no Postmark] → até lá o host de
  produção não responde e o e-mail sai pelo remetente da plataforma. Ambos são passos do super
  admin, listados no PR.
- [Tema repetido] → nenhuma regra ou teste exige tema único por tenant; o teste do registro só
  exige que mais de um tema esteja em uso.

## Migration Plan

Deploy único, sem migração de banco. Rollback é remover a linha do registro. Nenhum tenant
existente é tocado: o `HOST_MAP` é derivado do registro e ganha só as duas entradas novas.

## Open Questions

- WhatsApp real, horário exato e alíquota de ISS do município.
- Logos e foto do cartório.
- Situação da delegação da titular no CNJ Justiça Aberta.
- Se Canguaretama entrar em um próximo levantamento do Justiça Aberta, preencher `revenue`.
