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

## Atualização de 11/11/2026

- **Nome:** "Mensagens internas", no menu e na tela.
- **Aviso:** "o Tabelião/Registrador pode ler todas as conversas" fica no topo de cada conversa.
- **Foto:** clique na própria foto (etiqueta "+ Foto" ou "Trocar") ou use o botão em "Personalizar".
- **Microfone:**
  - o botão "Liberar microfone" faz o navegador perguntar;
  - quando o navegador bloqueou, a tela mostra o passo a passo para Chrome e Edge, iPhone e Android.
- **Status:**
  - Disponível, Em atendimento no balcão, Em reunião, Ocupado, Ausente;
  - "Horário de almoço" é automático e não pode ser escolhido à mão.
- **Horário de almoço:**
  - cada pessoa pede o próprio horário, de 15 minutos a 1 hora por dia;
  - o pedido vai para a auditoria e para o Tabelião/Registrador aprovar ou não, e não pode ser mudado até a decisão;
  - no horário aprovado, a pessoa aparece em almoço; depois, volta sozinha ao status escolhido.
- **Tabelião/Registrador, em Mensagens internas › Equipe e conversas:** aprova ou recusa o almoço e ativa ou desativa o chat de cada pessoa. Quem fica com o chat desativado não envia nem recebe mensagens.
- **Balão flutuante:**
  - chegou mensagem, aparece em qualquer tela um balão e a janelinha "Fulano diz:";
  - "Responder aqui" abre a conversa numa janela pequena no canto, sem sair da tela de trabalho;
  - enquanto houver mensagem sem ler, o som volta a cada 10 segundos e o título da aba pisca.
- **Configurações › Notificações:** os canais "Mensagens internas" e "Auditoria" ligam ou desligam o cartão, o som, a notificação do navegador e o tremor.

### Janelinha flutuante

- Ela tem **📎 Arquivo** e **🎤 Áudio**, como a tela completa.
- **Minimizar (botão com um traço):** vira uma barrinha com o nome da pessoa. Quando chega mensagem nova, a conversa reabre sozinha.
- **Mudar de lugar:** arraste pelo título (ou a barrinha). A posição fica lembrada neste navegador.
- **Microfone:** `Permissions-Policy: microphone=(self)` vale em todo o painel (`/admin`), para a janelinha gravar áudio em qualquer tela. O site público continua com o microfone desligado.

### Editar, apagar e limpar a conversa

Nada disso apaga dados do banco. Tudo fica guardado para a supervisão do
Tabelião/Registrador e vai para a auditoria.

- **Editar**: só o autor, só mensagem de texto. A mensagem passa a mostrar
  "(editada)". Na supervisão aparece a data da edição e o texto original
  (coluna `original_body`).
- **Apagar**: só o autor. Para as duas pessoas, no lugar da mensagem aparece
  "Mensagem apagada", e um arquivo apagado deixa de abrir no chat. Na
  supervisão, a mensagem continua visível com a marca "Apagada pelo autor"
  (colunas `deleted_at` e `deleted_by`). Fica na faixa "Análise" da
  auditoria.
- **Limpar conversa**: some só para quem limpou (coluna `cleared_at` em
  `messenger_members`). A outra pessoa e o Tabelião/Registrador continuam
  com todo o histórico. Mensagens novas aparecem normalmente.

A tela aberta acompanha edições e mensagens apagadas sem recarregar: cada
consulta devolve o horário do servidor, e a próxima traz o que foi enviado,
editado ou apagado depois dele.

Migração `0046_mensagens_editar_apagar_limpar.sql`: só acrescenta colunas.

### Horário de almoço no menu de status

O menu de status tem a opção "Horário de almoço". Ela não muda o status na
hora: abre logo abaixo o pedido do horário diário (até 1 hora), que vai para
o Tabelião/Registrador aprovar. No horário aprovado a pessoa aparece como
"Horário de almoço"; depois volta a aparecer disponível sozinha.
