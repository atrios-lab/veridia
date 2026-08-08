## 1. Dependência e provider

- [x] 1.1 Adicionar `sonner` como dependência (`pnpm add sonner`)
- [x] 1.2 Montar `<Toaster />` em `src/app/admin/layout.tsx` (layout raiz do admin, acima de
      `login` e do grupo `(dashboard)`)
- [x] 1.3 Configurar `toastOptions`/`classNames` do `<Toaster />` para usar os tokens existentes
      `admin-success-bg`/`admin-success-text` (sucesso) e `admin-error-bg`/`admin-error-text`
      (erro), sem nenhum hex fora de `@theme`

## 2. Migrar a confirmação da aba Identidade Visual

- [x] 2.1 Em `visual-identity-form.tsx`, importar `toast` de `sonner`
- [x] 2.2 Trocar o `useEffect` que hoje grava `publishedSignature` para, no lugar, disparar
      `toast.success("Publicado.")` quando `state.status === "saved"` (mesma dependência `[state]`)
- [x] 2.3 Remover `formSignature`, `publishedSignature`, `showPublished` e o bloco `<output>` do
      selo "Publicado." que eles sustentavam
- [x] 2.4 Conferir que o banner de erro (`state.status === "error"`, `role="alert"`) e os erros por
      campo continuam exatamente como estão — não migram para toast

## 3. Verificação

- [x] 3.1 Rodar typecheck (`npx tsc --noEmit`) e `npx biome check` nos arquivos tocados
- [x] 3.2 Testar ao vivo: logar no admin, trocar o estilo do site, salvar, confirmar que o toast
      de sucesso aparece e some sozinho, sem elemento fixo remanescente na tela
- [x] 3.3 Testar o cenário do bug original: publicar, trocar o estilo de novo sem salvar,
      confirmar que nada na tela sugere que a nova escolha já foi publicada
- [x] 3.4 Testar o toast de erro (ex.: forçar falha de gravação) e confirmar que aparece nas cores
      do estilo publicado da serventia, não numa cor fixa
- [x] 3.5 `openspec validate add-toast-notifications --type change --strict`
