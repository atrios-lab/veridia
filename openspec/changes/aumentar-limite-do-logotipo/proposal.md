## Why

O limite atual para o logotipo (e o selo, que compartilha a mesma regra) é 1 MB. Isso é apertado
demais para os PNGs com fundo transparente que as serventias costumam ter prontos, obrigando
compressão manual antes do envio. Elevar o teto para 3 MB reduz esse atrito sem abrir mão da
validação no servidor.

## What Changes

- Elevar o limite de tamanho do logotipo (fundo claro e escuro) de 1 MB para 3 MB.
- Atualizar a mensagem de dica na tela de Identidade Visual ("até 1 MB" → "até 3 MB").
- Manter a validação de tipo (PNG, JPG, WEBP) e a recusa no servidor sem alterações.
- Manter o limite da imagem do hero em 4 MB, sem mudança.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `admin-visual-identity`: o requisito de troca de logotipo passa a declarar o teto de tamanho
  explicitamente (3 MB para logotipo/selo, mantendo 4 MB para a foto de abertura).

## Impact

- `src/core/tenant/brand-image.ts`: constante `LOGO_MAX_BYTES` (1 MB → 3 MB) e seus testes em
  `src/core/tenant/brand-image.test.ts`.
- `src/app/admin/(dashboard)/configuracoes/identidade-visual/visual-identity-form.tsx`: texto de
  dica que informa o limite ao usuário.
- Nenhuma migração de banco, API pública ou dependência afetada.
