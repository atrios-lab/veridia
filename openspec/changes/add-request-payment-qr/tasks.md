## 1. Cidade da serventia no bloco Pix

- [ ] 1.1 Adicionar `city` ao objeto `pix` em `TenantSchema` (`src/core/tenant/schema.ts`), com
      validação (até 15 caracteres após normalização) e mensagem de erro em português
- [ ] 1.2 Adicionar normalização de `city` (maiúsculas, sem acento) em `src/core/tenant/pix.ts`
- [ ] 1.3 Testes unitários da normalização e validação de `city` (limites, acentos, vazio)
- [ ] 1.4 Adicionar campo "Cidade" a `pix-key-form.tsx`, com o mesmo controle de permissão
      (`billing.edit`) e texto de leitura/edição já usado para tipo e valor da chave
- [ ] 1.5 Atualizar a action de gravação (`configuracoes/cobranca/actions.ts`) para validar e
      gravar `city` junto de tipo e chave, com o mesmo registro em `audit_log`
- [ ] 1.6 Confirmar que `OfficePixSchema`/`OfficePixOverrideSchema` em `overrides.ts` herdam `city`
      automaticamente (via `.pick`) e ajustar se necessário

## 2. Payload Pix EMV no núcleo

- [ ] 2.1 Criar `src/core/payment/pix-charge.ts` com a montagem do TLV (payload format indicator,
      merchant account info com a chave, merchant category code, moeda, valor, país, nome, cidade,
      txid, CRC16)
- [ ] 2.2 Implementar CRC16-CCITT (polinômio `0x1021`, início `0xFFFF`) puro, sem dependência
- [ ] 2.3 Implementar a derivação do txid a partir do número do protocolo (remover pontuação,
      truncar a 25 caracteres)
- [ ] 2.4 Testes unitários com payloads Pix de referência conhecidos (fixtures), incluindo
      conferência byte a byte do CRC
- [ ] 2.5 Testes cobrindo valores no limite (nome/cidade truncados, valor com centavos)

## 3. Renderização do QR code

- [ ] 3.1 Adicionar a dependência `qrcode` (server-side) ao `package.json`
- [ ] 3.2 Criar helper de renderização do payload como SVG inline (Server Component ou função
      utilitária chamada por um Server Component)
- [ ] 3.3 Testes garantindo que o helper não é chamado quando faltar chave, cidade ou valor

## 4. Consulta pública de protocolo

- [ ] 4.1 Estender `PublicStatus` (`protocolo/page.tsx`) com o valor formatado e, quando
      disponível, o QR/copia-e-cola
- [ ] 4.2 Estender `ServiceRequestDetail` (`protocolo/actions.ts`) da mesma forma para o detalhe
      completo
- [ ] 4.3 Montar o payload e o QR no servidor a partir de `amountCents`, `tenant.pix.key` e
      `tenant.pix.city`, sem expor a chave Pix bruta desnecessariamente na resposta
- [ ] 4.4 Novo bloco de UI em `protocol-lookup.tsx` (resumo sem chave e detalhe com chave): valor
      formatado, QR code, código Copia e Cola com `CopyField`, e instrução de pagar no balcão
      quando não houver QR
- [ ] 4.5 Ajustar o texto "nomes, documentos e valores ficam protegidos" no resumo sem chave, já
      que o valor deixa de ser protegido
- [ ] 4.6 Testes (`node --test`) cobrindo os quatro cenários: sem valor, valor sem chave/cidade,
      valor com chave e cidade, serventia com chave antiga sem cidade

## 5. Ponta a ponta

- [ ] 5.1 Atualizar/estender `e2e/service-request.spec.ts` (Playwright) cobrindo a exibição do
      valor e do QR na consulta de protocolo
- [ ] 5.2 Rodar o fluxo manualmente: operador define valor → serventia com chave e cidade →
      cidadão consulta protocolo → QR escaneável por um app de banco real
