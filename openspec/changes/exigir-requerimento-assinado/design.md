## Context

O envio do documento assinado existe em dois formatos. `SignedFormUpload` atende a tela de sucesso e `/protocolo`. O `SignCard` de `/acompanhar` tem uma cópia própria do mesmo fluxo, e `/acompanhar` é a consulta que o site usa: `SECTION_ROUTES["consulta-protocolo"]` aponta para ela, e é para lá que o botão "Acompanhar pedido" leva. Os dois formatos enviam ao escolher o arquivo, decisão registrada no comentário do componente.

A spec já diz que a falta do envio não trava o registro. Falta dizer que o pedido não tramita sem o assinado. O painel não impede o operador de mover um pedido sem o assinado, e esta change não muda isso.

## Goals / Non-Goals

**Goals:**

- O cidadão entende, na tela de sucesso, que assinar e devolver é obrigatório para o pedido andar.
- Quem envia confirma, vendo o nome do arquivo, que é o documento certo e assinado.
- Um único componente de envio nos três pontos.

**Non-Goals:**

- Trava no painel, verificação do conteúdo do arquivo e registro da confirmação no banco (ver a proposta).
- Pisca fora da tela de sucesso.

## Decisions

### Confirmação na própria linha, depois de escolher o arquivo

O `SignedFormUpload` ganha um estado intermediário: com o arquivo escolhido, mostra o nome, a caixa de confirmação, o aviso sobre documento diverso, "Trocar" e "Enviar". O input continua montado e guarda o arquivo; é o `FormData` do mesmo formulário que vai para `send`.

Alternativas descartadas: caixa antes de escolher, porque a pessoa confirmaria sem saber qual arquivo vai mandar; modal, porque funciona mal no celular e costuma ser fechado sem leitura.

O arquivo é validado ao ser escolhido com `validateAttachments`, que já existe, para a recusa aparecer antes da confirmação. A confirmação volta desmarcada a cada arquivo novo e depois de um envio. Se o seletor for cancelado sem arquivo, a tela volta ao estado inicial.

### O `SignCard` passa a usar o `SignedFormUpload`

A confirmação é regra nova, e mantê-la em duas cópias convida a divergência. O `SignCard` troca o formulário próprio por `<SignedFormUpload documento="requerimento" onSent={onSigned} />`, como `/protocolo` já faz. O cartão some quando o pai recebe `onSigned`, então a linha de "enviado" do componente não chega a incomodar. O custo é perder o tamanho maior da caixa de envio de `/acompanhar`; o componente pode receber uma classe se a diferença aparecer no navegador.

### Regra da confirmação no núcleo; servidor recusa sem ela

`src/core/request/attachment.ts` exporta o nome do campo e `isSignedFormConfirmed(value)`, ao lado de `isSignedFormDocument`. `attachSignedForm` chama a função depois de validar protocolo e chave e antes de `collectAttachments`, para nada ser armazenado sem confirmação. A checagem existe porque a regra não pode viver só em um botão desativado, mesmo não sendo controle de acesso.

Com o Blob ligado, o arquivo sobe do navegador antes da ação. Um cliente adulterado pode deixar um arquivo órfão no store, como já pode hoje com protocolo errado; não há anexo no pedido, e é isso que a regra protege.

### Textos em `requerimento.ts`

Os textos novos ficam em `src/core/request/requerimento.ts`, ao lado de `HANDWRITTEN_SIGNATURE_CAVEAT`, porque as três telas os repetem:

- Aviso: "Sem o requerimento assinado, a serventia não dá andamento ao pedido."
- Confirmação do requerimento: "Confirmo que este arquivo é o requerimento deste pedido, já assinado."
- Confirmação da declaração: "Confirmo que este arquivo é a declaração de hipossuficiência deste pedido, já assinada."
- Documento diverso: "Se for outro documento, o pedido não tramita na serventia."
- Balcão: "Se preferir, entregue o requerimento assinado em papel no balcão. Sem ele, o pedido não tramita."

### Destaque: `Step` ganha um modo, e a cor é a de alerta do tema

`Step` recebe `emphasis?: "blink" | "alert"`. Os dois desenham borda de 2 px em `brand-alert`; `blink` acrescenta a animação. A faixa do passo 2 é sólida em `brand-alert` com texto branco, seguindo a regra de destaque em cor cheia. `--palette-alert` é o único vermelho do sistema e é igual em todos os temas, então nenhuma cor nova entra e nenhum hex sai de `@theme`.

A animação é `--animate-signature-blink` em `globals.css`, no mesmo bloco de `notice-rise`: alterna só `border-color` entre o alerta e a borda neutra, em ciclo de 1,2 s. Mudar só a cor não desloca o layout.

### O pisca termina no download

`SuccessScreen` guarda duas informações: se o requerimento foi baixado (`onSubmit` do formulário de download) e se foi enviado (`onSent` do `SignedFormUpload`). A ênfase do passo 2 é `blink` antes do download, `alert` depois, e nenhuma depois do envio.

Piscar sem parar impediria a leitura do próprio passo e violaria a WCAG 2.2.2, que exige meio de interromper o que pisca por mais de 5 s. O download é o gesto que o pisca pede, então é a parada natural. O ciclo de 1,2 s fica abaixo do limite de três piscadas por segundo da WCAG 2.3.1, e `motion-reduce:animate-none` deixa a borda fixa para quem pede movimento reduzido.

Só o download do requerimento conta. O da declaração não para o pisca, porque o aviso é sobre o requerimento.

## Risks / Trade-offs

- [O aviso diz "não tramita", mas o painel deixa o operador mover o pedido] → É a regra da serventia comunicada ao cidadão. Se o sistema precisar segurar, é outra change, no painel.
- [O texto vale para todas as serventias, e uma delas pode aceitar o pedido sem o assinado em algum ato] → A spec já diz que todo pedido feito pelo site pede o requerimento assinado. Confirmar com as serventias antes do deploy.
- [Dois gestos em vez de um reduzem os envios concluídos] → A fricção é o objetivo. Quem abandona ainda vê o aviso, e o pedido segue registrado.
- [O cidadão marca a caixa sem ler] → Sobra a conferência da serventia. A confirmação reduz o erro por distração, não o elimina.
- [Recarregar a tela de sucesso perde o estado] → A tela já só existe no resultado da ação; recarregar sai dela. Nada muda.

## Migration Plan

Sem migração de banco. Pedidos antigos sem assinado passam a mostrar o texto novo na consulta. Reverter o deploy desfaz tudo, sem resíduo.

## Open Questions

- O aviso de documento diverso diz "o pedido não tramita" também na declaração de hipossuficiência. A serventia pode preferir tratar esse caso por exigência; se for assim, o texto da declaração muda, sem afetar o desenho.
