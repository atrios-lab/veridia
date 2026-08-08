## Why

O painel administrativo não tem um sistema de notificação transitória (toast). Cada tela resolve
"como confirmar que salvou" do seu próprio jeito: banners `role="alert"` fixos, `<output>` ao lado
do botão, ou nada. Isso já causou um bug real na aba Identidade Visual — o selo inline "Publicado."
ficava na tela mesmo depois do usuário trocar o tema de novo sem salvar, dando a entender que a
nova escolha já tinha ido ao ar (corrigido às pressas rastreando uma assinatura dos valores
salvos). Um toast, por natureza, aparece e some sozinho: a classe inteira desse bug ("confirmação
que sobrevive ao estado que ela confirmava") deixa de existir, sem gambiarra por tela.

## What Changes

- Introduzir `sonner` como o padrão do painel para feedback transitório de sucesso/erro (o que
  hoje é resolvido com banners fixos ou `<output>` ad hoc por formulário).
- Montar o `<Toaster />` uma vez no layout raiz do admin (`src/app/admin/layout.tsx`), disponível
  para qualquer tela disparar um toast sem configuração própria.
- Migrar a confirmação de "Salvar e publicar" da aba Identidade Visual do selo inline "Publicado."
  para um toast de sucesso, e remover o rastreamento de assinatura (`publishedSignature` /
  `formSignature`) que hoje existe só para evitar o selo ficar obsoleto — o toast não precisa
  desse controle porque não permanece na tela.
- Erros de validação por campo (mensagens sob cada input) e banners de erro que bloqueiam o
  formulário **não** mudam: continuam fixos, ancorados ao campo/formulário, porque não são
  confirmações transitórias.

## Capabilities

### New Capabilities

- `toast-notifications`: sistema de notificação transitória do painel administrativo — o
  `<Toaster />` montado no layout, e o contrato de quando/como uma tela deve disparar um toast de
  sucesso ou erro em vez de um banner fixo.

### Modified Capabilities

- `admin-visual-identity`: o requisito "Publicação atômica com descarte" passa a confirmar a
  gravação bem-sucedida por um toast em vez do selo inline "Publicado.", removendo o comportamento
  hoje implícito de o selo permanecer visível após novas edições não salvas.

## Impact

- Nova dependência: `sonner`.
- `src/app/admin/layout.tsx`: adiciona o provider `<Toaster />`.
- `src/app/admin/(dashboard)/configuracoes/identidade-visual/visual-identity-form.tsx`: troca o
  selo `<output>` por uma chamada de toast; remove `publishedSignature`/`formSignature` e o
  `useEffect` associado.
- Nenhuma migração de banco, nenhuma mudança de API pública, nenhum impacto no site do cidadão
  nesta mudança.

## Non-Goals

- Não migrar os demais banners/`<output>` de erro e sucesso já existentes no painel ou no site
  público (chat, login, protocolo, solicitar, etc.) — esta mudança introduz o padrão e aplica na
  Identidade Visual; migrar o restante fica para mudanças futuras, tela a tela.
- Não alterar o padrão de erro de validação por campo (mensagens fixas sob o input) nem os
  banners `role="alert"` que bloqueiam o formulário até o usuário corrigir — toast é só para
  confirmação transitória, não substitui erro que precisa permanecer visível.
- Não adicionar toast ao site público (cidadão) nesta mudança — escopo é só o painel
  administrativo.
