## Why

Na guia de transmissão (ITIV e as demais) o cliente e o funcionário digitam à mão os dados que já
estão nos documentos: a matrícula do imóvel, a escritura ou o contrato e os documentos das partes.
Decisão de 14/11/2026: anexar os documentos nos campos da guia, o sistema lê e preenche, e o
cliente ou o funcionário só confere e salva.

## What Changes

- **Site (pedido de guia):** caixa "Anexe os documentos e o sistema preenche" nos campos da guia.
  O PDF pesquisável é lido e preenche só os campos em branco (partes com CPF ou CNPJ válido,
  estado civil, profissão, endereço, matrícula, inscrição imobiliária, descrição do imóvel e
  valor). Os arquivos seguem com o pedido no campo de anexos que já existe ("anexos"), sob a regra
  de 30 dias depois do encerramento do protocolo. O cliente é avisado de enviar em PDF pesquisável
  ou digitalizado em ótima qualidade.
- **Painel (Utilitários › Guias):** a mesma leitura no formulário da guia, sem guardar o arquivo,
  com o aviso de que os documentos do cliente ficam no pedido por 30 dias depois do encerramento e
  devem ser baixados para o arquivo da serventia (nuvem ou HD).
- Foto ou PDF digitalizado sem texto não é lido nesta etapa: vai anexado e a pessoa preenche.

## Impact

- Novo núcleo `src/core/guides/reading.ts` (leitura do texto, sem nada inventado) e
  `src/lib/guide-reading.ts` (extração do texto do PDF em memória).
- Sem migração.
