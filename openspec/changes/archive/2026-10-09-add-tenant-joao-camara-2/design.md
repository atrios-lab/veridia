## Context

Registrar uma serventia na Veridia é escrever um arquivo de configuração validado por
`TenantSchema` e adicioná-lo ao registro em `resolve.ts`. Foi assim com todas as serventias já
registradas. O 2º Ofício de João Câmara segue o mesmo caminho.

João Câmara / RN tem dois ofícios. O 1º (CNS 09.379-9) fica com notas, imóveis, títulos e
documentos e pessoas jurídicas; o 2º (CNS 09.420-1), que entra agora, com notas, protesto e
registro civil das pessoas naturais. Não foi encontrado site nem perfil oficial da serventia.

Os agregadores divergem em tudo: quatro endereços (Rua Antônio Proença, 241; Rua Cícero Varela,
258; Rua João Joaquim, 44-B; Rua Rita Ferreira de Faria, s/n), três responsáveis e três
telefones. Por isso a fonte desta change é o cadastro do CNJ, consultado no portal público do
Justiça Aberta (`justicaaberta.cnj.jus.br/produtividade-serventia-extrajudicial/094201`) em
09/10/2026:

- Denominação "2° OFÍCIO DE JOÃO CÂMARA", criada em 10/03/1981, privatizada.
- Situação da delegação: vaga. Responsável Gladis Rosane Schmidt, interina, assunção em
  13/05/2024.
- Atribuições: Registro Civil das Pessoas Naturais, Protesto de Títulos, Notas.
- Rua Antonio Proença, 241, Centro, João Câmara/RN, 59550-000.
- Telefone (84) 4042-1044; e-mail protestojc2@gmail.com.
- Horário: segunda a sexta, 8h às 17h.
- Receita bruta: R$ 298.905,11 em 01/01–30/06/2026 e R$ 192.976,58 em 01/07–31/12/2025.

O cartorio.net.br espelha o mesmo cadastro (endereço, telefone, interina e data). As demais
fontes (Gazeta do Povo, cartorios.info, sistemafederal.com.br) estão desatualizadas.

Confirmado pelo responsável do projeto: o domínio `2cartoriojoaocamararn.com.br` é o da
serventia. Ele está registrado em nome da Átrios e já aponta para os nameservers da Vercel.

## Goals / Non-Goals

**Goals:**
- Servir o site público e o painel do 2º Ofício de João Câmara por host próprio, sem código
  específico.
- Registrar o que o cadastro do CNJ traz; deixar o resto marcado como pendente com comentário
  `ponytail:`.

**Non-Goals:**
- Mudar schema, gating, banco ou qualquer comportamento compartilhado.
- Subir marca, foto de hero, chave Pix ou `emailFrom`.
- Criar contas de admin, DNS, domínio na Vercel ou verificação no Postmark.

## Decisions

**1. O CNJ como fonte, não os agregadores.** Com quatro endereços em circulação, nenhum
consenso entre agregadores serve de critério, que foi o usado em Mipibu e Brejinho. O cadastro
do Justiça Aberta é o que a própria serventia declara e mantém. Alternativa descartada: deixar
o endereço de fora até a serventia confirmar. Faria sentido sem fonte oficial, mas o CNJ é a
fonte oficial.

**2. Endereço entra, com acento.** O CNJ grafa "Antonio Proença"; o site usa "Rua Antônio
Proença, 241, Centro, João Câmara - RN, 59550-000", com a ortografia correta. A página de
contato ganha o cartão de mapa e a rota "Como chegar".

**3. Três atribuições: RCPN, NOTAS, PROTESTO.** É o que o CNJ lista. O cartorios.info acrescenta
"registro de contratos marítimos", que não é atribuição do schema nem aparece no CNJ.

**4. Responsável com status `interino`.** Como no piloto, o status foi conferido no Justiça
Aberta, não deduzido de agregador: delegação vaga, Gladis Rosane Schmidt interina desde
13/05/2024. Por isso não fica `a confirmar`, ao contrário das serventias registradas só por
agregador. O DPO leva o mesmo nome, como nas
demais.

**5. Um só telefone.** O CNJ traz apenas (84) 4042-1044. Entra como `phone` e `whatsapp`, mesma
solução de Major Sales, Canguaretama e Brejinho. Marcado `ponytail:`: um 4042 dificilmente é
WhatsApp. O celular (84) 99142-3850 do cartorios.info está ligado ao responsável de 2016 e não
entra.

**6. Contato institucional no domínio novo.** `contato@2cartoriojoaocamararn.com.br` e DPO em
`dpo@2cartoriojoaocamararn.com.br`, mesma regra de Canguaretama e Brejinho. O Gmail do cadastro
do CNJ (`protestojc2@gmail.com`) fica registrado em comentário, para o caso de a serventia
preferir mantê-lo. As caixas ainda não existem; a LGPD (art. 41 §3) exige o canal de DPO, então
ele entra antes da caixa existir.

**7. `emailFrom` fica de fora.** Um From em domínio que o Postmark não verificou é recusado,
enquanto o remetente da plataforma entrega. Entra quando o super admin verificar o domínio.

**8. `revenue` entra, extraído em 09/10/2026.** A serventia não estava no levantamento de
10/07/2026, mas o portal público já traz os dois últimos semestres declarados: `semester`
298905.11 (1º/2026), `previousSemester` 192976.58 (2º/2025), `source` `justica-aberta`,
`extractedOn` `2026-10-09`. Os dois semestres têm declaração; nenhum zero é gravado.

**9. Horário corrido, 8h às 17h.** É o que o CNJ traz. `counterHours` 8–17 e `openingHours`
"Segunda a sexta, das 8h às 17h". Sem `ponytail:`, porque vem da fonte oficial.

**10. Tema `oliva-terracota`.** Escolhido pelo responsável do projeto. Usado só por Mipibu 2 e
Bento Fernandes.

**11. Nomes.** `name` "2º Cartório de João Câmara"; `subtitle` e `home.title` "2º Ofício de
Notas, Protesto e Registro Civil de João Câmara / RN", no molde de Mipibu 2. Slug
`cartorio-joao-camara-2`, arquivo `joao-camara-2.ts`, export `cartorioJoaoCamara2`, como
`cartorio-sao-jose-de-mipibu-2`. Host local `joaocamara.localhost`.

**12. Município "JOAO CAMARA".** Onze caracteres sem acento, cabe nos quinze do Merchant City
do Pix.

**13. Marca padrão da plataforma.** Logos `selo-padrao-*`, como todas as serventias sem
identidade própria.

## Risks / Trade-offs

- [Cadastro do CNJ desatualizado em algum campo] → é declarado pela própria serventia; qualquer
  correção é uma edição de string.
- [Telefone 4042 usado como WhatsApp] → comentário `ponytail:`; a serventia informa o número
  real.
- [`issRate` 0,05 assumido] → alíquota municipal precisa de confirmação antes de cobrar;
  marcado `ponytail:`, igual às demais.
- [Domínio sem projeto na Vercel e sem verificação no Postmark] → até lá o host de produção não
  responde e o e-mail sai pelo remetente da plataforma. Ambos são passos do super admin,
  listados no PR.

## Migration Plan

Deploy único, sem migração de banco. Rollback é remover a linha do registro. Nenhum tenant
existente é tocado: o `HOST_MAP` é derivado do registro e ganha só as duas entradas novas.

## Open Questions

- WhatsApp real e alíquota de ISS do município.
- Se a serventia prefere manter o Gmail do cadastro do CNJ como contato público.
- Logos e foto do cartório.
