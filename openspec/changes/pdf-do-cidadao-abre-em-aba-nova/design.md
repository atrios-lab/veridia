## Contexto

Seis forms do site público fazem POST em `/solicitar/requerimento` (`route.ts` responde
`Content-Type: application/pdf` com `Content-Disposition: inline`). Dois já têm
`target="_blank" rel="noopener"` (`protocol-trilho.tsx:1452`, `protocol-lookup.tsx:1204`);
quatro não:

| Arquivo | Botão |
|---|---|
| `solicitar/request-form.tsx:706` | Baixar comprovante (PDF) |
| `solicitar/request-form.tsx:729` | Baixar requerimento (PDF) |
| `acompanhar/protocol-trilho.tsx:726` | PDF (passo "Baixe o formulário já preenchido") |
| `protocolo/protocol-lookup.tsx:1076` | Baixe o requerimento preenchido |

Sem `target`, o POST navega a aba atual. Em `/solicitar` a tela de sucesso é
`state.status === "success"` de um `useActionState` (`request-form.tsx:86`): não há URL nem
armazenamento por trás dela. Voltar remonta o componente em `idle`, e a chave, que só existe
nessa resposta, se perde. Quando o bfcache restaura a página, o cidadão tem sorte; quando não
(o comum depois de um POST), não tem.

No painel os três botões equivalentes já estão certos, e a investigação descartou CSP,
`X-Frame-Options`, listeners globais e service worker: o markup é o único culpado.

## Decisão: `target="_blank" rel="noopener"` nos quatro forms

O atributo que os dois vizinhos já usam, no mesmo lugar. Quatro linhas de diff, nenhuma mudança
de rota, e o cidadão continua vendo o PDF na hora, o que importa a quem precisa conferir a chave
antes de fechar.

`rel="noopener"` é válido em `<form>` e evita que a aba do PDF ganhe `window.opener` sobre a tela
da chave. Sem `noreferrer`: o referrer é a própria origem e a política já é
`strict-origin-when-cross-origin`.

### Alternativa descartada: `Content-Disposition: attachment` na rota

Resolveria os quatro de uma vez e tiraria os dois `_blank` existentes (com `attachment`, uma aba
`_blank` abre e fecha em branco). Mas no celular o arquivo vai para a pasta de downloads sem ser
mostrado, e a rota é compartilhada pelas três telas: a decisão de UX de uma passaria por cima
das outras. Fica como opção se a aba nova incomodar.

## Verificação

O e2e atual chama a rota por `request.post` e nunca clica nos botões; foi assim que quatro
esquecimentos passaram. Teste novo em `e2e/service-request.spec.ts`, na tela de sucesso:

```
const [popup] = await Promise.all([
  context.waitForEvent("page"),
  page.getByRole("button", { name: "Baixar comprovante (PDF)" }).click(),
]);
```

e, depois, protocolo e chave ainda visíveis em `page`. O Chromium headless do Playwright não tem
visualizador de PDF e trata a resposta como download, então a asserção é sobre a aba ter aberto
e a tela de origem ter ficado, não sobre o PDF renderizado — o conteúdo já é coberto pelos testes
de rota existentes.

## Riscos

- [Bloqueador de pop-up] → Não se aplica: submit de form com `target="_blank"` a partir de um
  clique é gesto do usuário, o mesmo que os dois forms vizinhos já fazem sem queixa. O bloqueio
  atinge `window.open` encadeado, que só existe no painel.
- [Leitores de tela não avisados da aba nova] → O botão diz "(PDF)" e o ícone é de download;
  abrir em aba nova é o comportamento que o rótulo já sugere.
