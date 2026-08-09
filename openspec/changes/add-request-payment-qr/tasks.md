## 1. Cidade da serventia no bloco Pix

- [x] 1.1 Adicionar `city` ao objeto `pix` em `TenantSchema` (`src/core/tenant/schema.ts`), com
      validação (até 15 caracteres após normalização) e mensagem de erro em português
- [x] 1.2 Adicionar normalização de `city` (maiúsculas, sem acento) em `src/core/tenant/pix.ts`
- [x] 1.3 Testes unitários da normalização e validação de `city` (limites, acentos, vazio)
- [x] 1.4 Adicionar campo "Cidade" a `pix-key-form.tsx`, com o mesmo controle de permissão
      (`billing.edit`) e texto de leitura/edição já usado para tipo e valor da chave
- [x] 1.5 Atualizar a action de gravação (`configuracoes/cobranca/actions.ts`) para validar e
      gravar `city` junto de tipo e chave, com o mesmo registro em `audit_log`
- [x] 1.6 Confirmar que `OfficePixSchema`/`OfficePixOverrideSchema` em `overrides.ts` herdam `city`
      automaticamente (via `.pick`) e ajustar se necessário — `city` ficou opcional em
      `TenantSchema.shape.pix` (não required): uma chave já cadastrada antes deste campo existir
      não tem `city` no JSONB e nenhuma migração faz o backfill, então exigi-lo ali quebraria o
      parse do override inteiro e faria a chave (não só o QR) sumir do admin e do site. Fica
      obrigatório só no ponto de gravação (`savePixKey`), que é onde a spec pede.

## 2. Payload Pix EMV no núcleo

- [x] 2.1 Criar `src/core/payment/pix-charge.ts` com a montagem do TLV (payload format indicator,
      merchant account info com a chave, merchant category code, moeda, valor, país, nome, cidade,
      txid, CRC16)
- [x] 2.2 Implementar CRC16-CCITT (polinômio `0x1021`, início `0xFFFF`) puro, sem dependência
- [x] 2.3 Implementar a derivação do txid a partir do número do protocolo (remover pontuação,
      truncar a 25 caracteres)
- [x] 2.4 Testes unitários com payloads Pix de referência conhecidos (fixtures), incluindo
      conferência byte a byte do CRC — usa o valor de conferência padrão do CRC-16/CCITT-FALSE
      ("123456789" → `29B1`) mais uma segunda implementação do CRC (tabela, não bit a bit) para
      conferir os payloads montados, já que não havia como validar offline um payload Pix externo
      byte a byte com confiança
- [x] 2.5 Testes cobrindo valores no limite (nome/cidade truncados, valor com centavos)

## 3. Renderização do QR code

- [x] 3.1 Adicionar a dependência `qrcode` (server-side) ao `package.json` — já estava presente
- [x] 3.2 Criar helper de renderização do payload como SVG inline (`src/lib/pix-qr.ts`, chamado
      pelos Server Components de `protocolo/page.tsx` e `protocolo/actions.ts`)
- [x] 3.3 Testes garantindo que o helper não é chamado quando faltar chave, cidade ou valor — o
      gate (`canBuildPixCharge`) foi extraído como função pura em `pix-charge.ts` justamente para
      ser testável sem tocar `server-only`/`qrcode`

## 4. Consulta pública de protocolo

- [x] 4.1 ~~Estender `PublicStatus` (`protocolo/page.tsx`) com o valor formatado e, quando
      disponível, o QR/copia-e-cola~~ — revertido: decisão de produto (ver design.md, decisão 5)
      é que valor e QR ficam atrás da chave de acesso, então `PublicStatus` (resumo sem chave)
      não carrega nem valor nem QR; só `ServiceRequestDetail` (4.2) carrega
- [x] 4.2 Estender `ServiceRequestDetail` (`protocolo/actions.ts`) com o valor formatado e, quando
      disponível, o QR/copia-e-cola — único lugar onde aparecem, atrás da chave de acesso
- [x] 4.3 Montar o payload e o QR no servidor a partir de `amountCents`, `tenant.pix.key` e
      `tenant.pix.city`, sem expor a chave Pix bruta desnecessariamente na resposta
- [x] 4.4 Novo bloco de UI em `protocol-lookup.tsx`, só no detalhe completo (com chave): valor
      formatado, QR code, código Copia e Cola com `CopyField`, e instrução de pagar no balcão
      quando não houver QR — também corrigido `CopyField` (`protocol-reveal.tsx`), que não
      quebrava linha e vazava da tela com um payload Pix de ~140 caracteres (`min-w-0` + `break-all`)
- [x] 4.5 ~~Ajustar o texto "nomes, documentos e valores ficam protegidos" no resumo sem chave~~ —
      não precisou: como valor e QR ficaram atrás da chave junto com o resto, o texto já descrevia
      o comportamento final corretamente, sem mudança
- [x] 4.6 Testes (`node --test`) cobrindo os quatro cenários: sem valor, valor sem chave/cidade,
      valor com chave e cidade, serventia com chave antiga sem cidade — cobertos pelos testes
      puros de `canBuildPixCharge`/`formatCents`; `page.tsx`/`actions.ts` são glue de Server
      Component com DB, sem precedente de teste unitário direto neste repo (só e2e)

## 5. Ponta a ponta

- [ ] 5.1 Atualizar/estender `e2e/service-request.spec.ts` (Playwright) cobrindo a exibição do
      valor e do QR na consulta de protocolo
- [ ] 5.2 Rodar o fluxo manualmente: operador define valor → serventia com chave e cidade →
      cidadão consulta protocolo → QR escaneável por um app de banco real — verificado manualmente
      via browser neste ambiente (payload conferido campo a campo); falta testar com um app de
      banco real
