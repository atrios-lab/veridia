# Assinador digital (ICP-Brasil)

## O que faz

- A serventia cadastra certificados **A1** (e-CPF e e-CNPJ) em **Configurações › Certificados**.
- O administrador marca quem pode assinar com cada certificado.
- Em **Utilitários › Assinador digital**, quem está autorizado envia um PDF, escolhe o certificado, digita a
  senha e assina.
- Cada página recebe a faixa lateral e o QR Code de verificação.
- No fim da faixa, no alto da borda direita, fica a marca da plataforma
  (decisão de 11/11/2026). É o "chapéu" do logo da Átrios, desenhado em
  vetor, com "Assinador digital ÁTRIOS" e, abaixo, o 0800 878 0304, em azul
  discreto. O texto da faixa encolhe para caber, se for preciso.
- O documento pode ser coassinado por outra pessoa, e a primeira assinatura continua válida.
- O cidadão confere em `/verificar`, pelo código, pelo QR ou pelo próprio PDF, e baixa o manifesto de
  assinaturas. A página inicial tem o cartão **Validar documento**, e a página de verificação mostra a base
  legal (`LEGAL_VALIDITY_NOTES` em `src/core/signature/policy.ts`).
- Dá para assinar **vários PDFs de uma vez**: o certificado e a senha são digitados uma vez só, e cada PDF
  vai num envio próprio (o servidor recebe no máximo cerca de 4,5 MB por envio). Uma senha errada para o lote.
- **PDF que já vem assinado** (uma CNH, uma certidão de outra serventia): as páginas não podem receber a faixa
  sem invalidar a assinatura anterior. Por isso, a faixa e o QR entram na primeira página como aparência da
  nova assinatura (o widget, em atualização incremental), com o nome de quem assinou e a data. O manifesto,
  nesse caso, fica só para baixar à parte.
- A faixa respeita o recorte (CropBox) e o giro (/Rotate) da página. Ela fica sempre na borda direita, do
  jeito que a página é lida.
- **Excluir da lista** não apaga nada. O arquivo deixa de abrir no painel e na página pública, o registro
  continua respondendo à verificação, e o documento pode voltar à lista em "Ver excluídos". Só quem assinou
  ou o Tabelião/Registrador faz isso, e tudo fica na auditoria. A migração `0042` só acrescenta as colunas
  `removed_at` e `removed_by`.

## Padrão técnico (fontes conferidas em 10/11/2026)

| Item | Valor | Fonte |
| --- | --- | --- |
| Formato | PAdES, `SubFilter /ETSI.CAdES.detached` | ISO 32000 e ETSI EN 319 142 |
| Política | PA_PAdES_AD_RB_v1_1, OID 2.16.76.1.7.1.11.1.1 | `LPA_PAdES.der`, politicas.icpbrasil.gov.br |
| Hash da política (SHA-256) | `95752d26ca974d46675ae7fb787b606a71ea941f26b59f6b6a321f97d63b9cb1` | conferido no arquivo `PA_PAdES_AD_RB_v1_1.der` |
| Validade da política | até 02/03/2029 | `LPA_PAdES.der` |
| Atributos assinados | contentType, messageDigest, signingCertificateV2, sigPolicyId | `PA_PAdES_AD_RB_v1_1.der` |
| Base legal | MP 2.200-2/2001, art. 10, § 1º; Lei 14.063/2020, art. 4º, III | legislação federal |
| Uso da plataforma | Plataforma Eletrônica Oficial da Serventia, art. 208, II, "b", do Código Nacional de Normas (Provimento CNJ 180/2024) | o mesmo texto do rodapé do site |

A data e a hora da assinatura ficam em `/M` do dicionário da assinatura. A política AD-RB não usa carimbo do
tempo.

Quando a política vencer (2029), troque `ICP_POLICY` em `src/core/signature/policy.ts` pela versão que
estiver na lista oficial (`LPA_PAdES.der`).

## Segurança

- **Arquivo do certificado:** o `.pfx` é guardado com AES-256-GCM. A chave é `SIGNING_VAULT_KEY` (32 bytes
  em base64), se o deploy tiver uma; se não tiver, é derivada de `BETTER_AUTH_SECRET`. Trocar esse segredo
  deixa os certificados ilegíveis, e aí é só cadastrar de novo.
- **Senha do certificado:** nunca é guardada. Quem assina digita a senha a cada assinatura.
- **Auditoria:** cadastro, autorização, desativação e cada assinatura ficam registrados.

## Guarda (decisão de 10/11/2026)

- **PDF assinado:** fica 6 meses.
- **Registro da assinatura e manifesto:** ficam para sempre.

O expurgo do arquivo roda na leitura (lista e verificação), como o dos anexos dos pedidos.

## Como conferir no ITI

Envie o PDF assinado em <https://validar.iti.gov.br>. Os testes automáticos usam uma cadeia fictícia (AC Teste
Veridia), que o ITI não reconhece. A conferência com a cadeia ICP-Brasil real é feita com o certificado da
serventia, já em produção.
