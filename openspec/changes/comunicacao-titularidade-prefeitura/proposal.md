## Why

O Código Nacional de Normas (Provimento CNJ nº 149/2023), art. 184-A, incluído pelo Provimento CN
nº 174/2024 para cumprir o art. 4º da Resolução CNJ nº 547/2024, manda os cartórios de notas e de
registro de imóveis informarem às prefeituras, até o último dia útil do mês seguinte, todas as
mudanças na titularidade de imóveis do período. O dono do projeto pediu (14/11/2026) que o painel
faça isso em Utilitários: o tabelião envia a escritura ou o registro, o sistema lê, pega os dados e
cria a informação para a SEMUT, com assinatura digital ou física, como nos outros documentos.

Texto lido no compilado oficial do CNJ (14/11/2026):

- § 1º: as hipóteses são as mesmas da DOI entregue à Receita Federal;
- § 2º: remessa eletrônica, mediante recibo: notas à plataforma do CNB/CF, registro de imóveis à
  do ONR;
- § 3º: é obrigatório indicar o ato ou fato que ensejou a transmissão;
- § 9º (Provimento CN nº 212/2026): sem custas ou emolumentos para o município.

A tabela de operações é a "Tabela 6 – Tipo da operação imobiliária" do manual de importação da DOI
(Receita Federal).

## What Changes

- **Utilitários › Titularidade à prefeitura.**
  - **Lançar escritura ou registro:** envia o PDF pesquisável ou o Word (.docx), e o sistema lê o
    ato, a data, o livro e as folhas, a operação, o imóvel (matrícula, inscrição, endereço,
    destinação), os valores e as partes com CPF ou CNPJ. A pessoa confere e salva; o arquivo não
    fica guardado.
  - **Mês dos atos:** os atos por mês, o prazo (último dia útil do mês seguinte, com os dias sem
    expediente da serventia) e o aviso quando vence.
  - **Ofício do mês à SEMUT:** numerado, com o destinatário da configuração da Declaração de ISS,
    a fundamentação, a relação e a ficha de cada ato; ou o ofício sem movimento. Assinar
    digitalmente ou imprimir.
  - **Planilha do mês** (CSV com o código da DOI), para a plataforma.
  - **Registrar o envio:** data, canal e recibo.
- Alterar e excluir com justificativa; exclusão só marca. Auditoria em cada ato.
- Permissão própria em Perfis e permissões; série de numeração própria.

## Non-goals

- Envio automático às plataformas do CNB/CF e do ONR: dependem de credenciais e do manual técnico
  de API (art. 184-A, § 6º). A planilha e o registro do recibo cobrem o envio manual por ora.
- Leitura de PDF digitalizado (sem texto) ou de foto.

## Capabilities

### New Capabilities
- `titularidade-prefeitura`: comunicação mensal das mudanças de titularidade de imóveis à
  prefeitura.

## Impact

- Banco: tabelas `title_transfers` e `title_transfer_filings` (migração só aditiva).
- Painel: telas em Utilitários, permissão `titularidade.manage`, série `titularidade`.
