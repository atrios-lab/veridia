## Why

- **Acesso ao painel:** quem tivesse a senha de um funcionário entrava no painel. A assinatura digital já
  pede a senha do certificado, e um código a mais a cada assinatura só atrapalhava. A proteção certa é no
  acesso.
- **Verificação pública:** a página de verificação não tinha limite de consultas.
- **Nomes dos documentos:** os documentos enviados e entregues apareciam com nomes genéricos e repetidos
  ("documento-final", "anexo-1"), difíceis de localizar.

## What Changes

- **Acesso ao painel em duas etapas.** Depois da senha, o painel envia um código de 6 dígitos **ao e-mail
  de quem está entrando, e só dessa pessoa**. O código vale 10 minutos.
  - **Primeiro acesso:** o convite, em que a pessoa cria a senha, não pede código, e a redefinição de senha
    também não, porque o link já veio por e-mail. O código começa no acesso seguinte.
  - **Salvar este dispositivo:** marcando a opção, aquele dispositivo não pede mais o código (por até um ano).
  - **Configurações › Duas etapas:** o administrador escolhe, troca ou apaga o **e-mail de verificação** de
    cada pessoa (apagado, o código volta para o e-mail da conta). Ali também faz os dispositivos salvos de
    alguém **pedirem o código de novo**, a partir do próximo login dessa pessoa.
  - **Minha conta:** cada pessoa troca **só o próprio** e-mail de verificação, pelo menu com o nome no
    alto da tela, e confirma o e-mail novo com um código enviado a ele. Também pode fazer os próprios
    dispositivos salvos pedirem o código de novo.
  - **Átrios:** a conta mestre da Átrios (superadmin) não passa pelo código.
  - **Garantia:** `getSession` recusa sessão sem a confirmação, então toda tela, ação e rota do painel
    exige o código.
  - **Tentativas:** cinco códigos errados bloqueiam por 10 minutos.
  - **Onde fica:** a prova fica em cookies assinados (HMAC). As escolhas do administrador ficam em
    `tenant_content` (`office-access-codes`).
  - **Emergência:** `PANEL_ACCESS_CODE=off` desliga a etapa no deploy inteiro, para o caso de o e-mail cair.
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
