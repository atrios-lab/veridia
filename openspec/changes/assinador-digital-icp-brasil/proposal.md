## Why

A serventia precisa assinar documentos 100% digitais, sem imprimir, com certificado A1 da ICP-Brasil, e o
cidadão precisa conferir a autenticidade do documento no site da própria serventia, além do validador do ITI,
com segurança e de acordo com a LGPD e o Provimento CNJ nº 213/2026.

## What Changes

- **Configurações › Certificados** (só o administrador, `user.manage`):
  - cadastra **vários A1**, e-CPF e e-CNPJ;
  - lê titular, documento, AC emissora, série e validade do próprio certificado;
  - avisa quando o certificado vence em menos de 30 dias;
  - o administrador marca **quem pode assinar** com cada certificado;
  - um certificado pode ser **desativado**.
- **Guarda do certificado:**
  - o `.pfx` fica **criptografado** (AES-256-GCM) com a chave do servidor (`SIGNING_VAULT_KEY`, ou derivada de `BETTER_AUTH_SECRET`);
  - a **senha nunca é guardada**: quem assina digita a senha a cada assinatura.
- **Utilitários › Assinador digital:**
  - assina qualquer PDF de até 4 MB;
  - cada página recebe a **faixa lateral** (assinado com certificado ICP-Brasil, base legal, onde verificar e o código) e o **QR Code** de verificação;
  - opcionalmente, o **manifesto de assinaturas** entra no fim do documento;
  - a assinatura é **PAdES** com a política oficial **AD-RB v1.1** da ICP-Brasil (OID 2.16.76.1.7.1.11.1.1, hash conferido na lista oficial do ITI);
  - aceita **coassinatura** por atualização incremental, que mantém as assinaturas anteriores válidas;
  - um PDF que já vem assinado recebe só a nova assinatura, sem faixa.
- **Downloads:** PDF assinado e manifesto de assinaturas (PDF com o timbre da serventia).
- **Página pública `/verificar`:**
  - verifica pelo **código**, pelo **QR** (`/verificar/CÓDIGO`) ou pelo **PDF**: o navegador calcula o SHA-256 e o arquivo não sai do aparelho;
  - mostra os assinantes (CPF mascarado), as datas e os certificados;
  - permite baixar o documento e o manifesto;
  - no rodapé do site, o link "Verificar documento assinado".
- **Guarda dos arquivos:** o PDF assinado fica **6 meses**, e o **registro para sempre**. O expurgo do arquivo roda na leitura, como o dos anexos dos pedidos.
- **Banco: só acrescenta.** A migração `0040_assinador_digital` cria quatro tabelas:
  - `signing_certificates`;
  - `signing_certificate_signers`;
  - `signed_documents`;
  - `signed_document_signatures`.
- Dependência nova: `pdf-lib@1.17.1`, para pôr a faixa e o QR em PDFs existentes.

## Non-goals

- Carimbo do tempo (AD-RT) e certificados A3 em token. A política AD-RB não usa carimbo do tempo.
- Ler as assinaturas de um PDF assinado fora da plataforma. Para isso, a página indica o validar.iti.gov.br.
