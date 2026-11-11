# Mensagens internas

O mensageiro da serventia, no espírito dos programas de mensagens dos anos 2000.

## O que tem

- **Contatos:** todas as contas ativas da serventia. Cada uma aparece com foto (ou iniciais), um ponto de
  status (verde para disponível, vermelho para ocupado, amarelo para ausente, cinza para offline), a mensagem
  pessoal e o número de mensagens não lidas.
- **Conversa:** "Fulano diz:" com a hora, emoticons, envio de arquivos e de áudio gravado no próprio
  navegador. Enter envia e Shift+Enter quebra a linha.
- **Chamar atenção:** a janela da outra pessoa treme, com som (e vibração no celular). No máximo uma vez a
  cada 15 segundos por pessoa.
- **Em qualquer tela do painel:** chegou mensagem, toca o som "mensageiro" e aparece uma janelinha no canto,
  "Fulano diz: ...", que leva à conversa. O item Mensagens mostra quantas há sem ler.
- **Personalizar:** foto (JPG, PNG ou WEBP, até 2 MB), status, mensagem pessoal, cor da janela (verde, azul,
  vinho, grafite ou dourado) e som ligado ou desligado.

## Arquivos

PDF, imagens, documentos do Office e do LibreOffice, texto, CSV, ZIP e áudio, até 4 MB cada (o servidor
recebe no máximo cerca de 4,5 MB por envio). O tipo é conferido no servidor (`acceptedType` em
`src/core/messages/rules.ts`). O que executa (`.exe`, `.js` e outros) é recusado. Os arquivos ficam na pasta
da serventia, e só os participantes da conversa e o Tabelião/Registrador podem abri-los.

## Supervisão

O Tabelião/Registrador (e a conta da Átrios) vê **todas as conversas** em Mensagens › Todas as conversas,
só para leitura. Todos sabem disso: o aviso "As mensagens internas são do trabalho da serventia: o
Tabelião/Registrador pode ler todas as conversas" aparece na lista de contatos e no começo de cada conversa.

## Microfone

O site desliga o microfone em todas as páginas (`Permissions-Policy`). A exceção é `/admin/mensagens`, que
permite `microphone=(self)` para gravar os áudios.

## Banco

A migração `0044_mensagens_internas.sql` só cria `messenger_profiles`, `messenger_conversations`,
`messenger_members` e `messenger_messages`. Não apaga nem altera nada.
