## 1. Regra e textos no núcleo

- [x] 1.1 Adicionar o nome do campo de confirmação e `isSignedFormConfirmed` em `src/core/request/attachment.ts`, com testes em `src/core/request/request.test.ts`
- [x] 1.2 Adicionar os textos de aviso, confirmação (requerimento e declaração), documento diverso e balcão em `src/core/request/requerimento.ts`, com teste em `src/core/request/requerimento.test.ts` de que a confirmação nomeia cada documento

## 2. Servidor

- [x] 2.1 Fazer `attachSignedForm` recusar o envio sem confirmação, depois de validar protocolo e chave e antes de `collectAttachments`

## 3. Envio em duas etapas

- [x] 3.1 Em `SignedFormUpload`, escolher o arquivo passa a mostrar nome, confirmação, aviso de documento diverso, "Trocar" e "Enviar" desativado até marcar, sem enviar
- [x] 3.2 Validar o arquivo ao escolher com `validateAttachments`, mostrando a recusa sem oferecer a confirmação
- [x] 3.3 Zerar arquivo e confirmação a cada novo arquivo, ao cancelar o seletor e depois de um envio, inclusive em "Trocar arquivo"
- [x] 3.4 Atualizar o comentário do componente, que hoje descreve o envio em um gesto só

## 4. Consultas

- [x] 4.1 Trocar o formulário próprio do `SignCard` em `protocol-trilho.tsx` por `SignedFormUpload` com `onSent={onSigned}`, removendo o que ficar sem uso
- [x] 4.2 Em `/acompanhar`, mostrar o aviso no `SignCard` e substituir "Seu pedido continua valendo" pelo texto do balcão
- [x] 4.3 Em `/protocolo`, mostrar o aviso e substituir "o pedido não trava" pelo texto do balcão

## 5. Destaque na tela de sucesso

- [x] 5.1 Adicionar `--animate-signature-blink` em `src/app/globals.css`, alternando só `border-color` em ciclo de 1,2 s
- [x] 5.2 Dar a `Step` o modo `emphasis` (`blink` e `alert`), com borda em `brand-alert`, `motion-reduce:animate-none` e faixa sólida opcional
- [x] 5.3 Em `SuccessScreen`, guardar download e envio do requerimento e derivar a ênfase dos passos 2 e 3; o download da declaração não para o pisca
- [x] 5.4 Mostrar no passo 2 a faixa de obrigatório e o aviso, que saem depois do envio

## 6. Verificação

- [x] 6.1 Rodar os testes tocados (`src/core/request/request.test.ts` e `src/core/request/requerimento.test.ts`), o Biome e a checagem de tipos
- [x] 6.2 No navegador, pelo host de um cartório, percorrer a tela de sucesso: pisca, parada no download, escolha do arquivo, confirmação, envio e fim do destaque; repetir com pedido isento (dois documentos) e em largura de celular
- [x] 6.3 No navegador, conferir o envio com confirmação e os textos novos em `/acompanhar` e `/protocolo`
- [x] 6.4 Conferir que a regra `motion-reduce:animate-none` chega compilada ao CSS (o navegador usado não emula movimento reduzido)
- [x] 6.5 Tentar enviar sem a confirmação (removendo o campo do formulário) e conferir a recusa, sem anexo no pedido
