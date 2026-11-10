## Why

- **Acesso ao painel:** quem tivesse a senha de um funcionário entrava no painel. A assinatura digital já
  pede a senha do certificado, e um código a mais a cada assinatura só atrapalhava. A proteção certa é no
  acesso.
- **Verificação pública:** a página de verificação não tinha limite de consultas.
- **Nomes dos documentos:** os documentos enviados e entregues apareciam com nomes genéricos e repetidos
  ("documento-final", "anexo-1"), difíceis de localizar.

## What Changes

- **Acesso ao painel em duas etapas.** Depois da senha, o painel envia um código de 6 dígitos ao e-mail da
  conta, e só libera o acesso com ele.
  - O código vale 10 minutos.
  - A confirmação vale até a sessão terminar. Um novo login pede de novo.
  - `getSession` recusa sessão sem a confirmação, então toda tela, ação e rota do painel exige o código.
  - Cinco códigos errados bloqueiam por 10 minutos.
  - Nada vai para o banco: a prova fica em cookies assinados (HMAC), ligados à sessão.
  - `PANEL_ACCESS_CODE=off` desliga a etapa no deploy inteiro, para o caso de o provedor de e-mail cair.
- **Assinatura sem código extra.** Assinar pede o login (já em duas etapas) e a senha do certificado.
- **Limite em /verificar.** São 30 consultas ou downloads por endereço a cada 10 minutos. Abrir a página não
  conta.
- **Nome do documento em todo envio de arquivo, com o botão "Sugestões".**
  - **No painel:** entrega ao cidadão, anexo do balcão, anexos do agendamento e relatório da LGPD.
  - **No site:** pedido de serviço (um nome por arquivo da lista), documentos enviados depois na consulta e
    no acompanhamento, resposta à exigência, documento do agendamento, LGPD e ouvidoria.
  - Um nome para vários arquivos é numerado: "RG", "RG (2)".
  - Arquivos com papel fixo (requerimento assinado, comprovante) mantêm o nome deles.
  - A entrega sem nome sai como "Documento final · REQ..." e numera as seguintes. Cada documento entregue
    pode ser renomeado.
  - Os anexos antigos aparecem como "Anexo 1" e "Documento final".
- O download do painel aceita nomes com acento sem quebrar o cabeçalho HTTP (RFC 6266).
- **Banco:** nenhuma migração.
