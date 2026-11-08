## 1. Catálogo e regra

- [x] 1.1 Adicionar `ActVariant.requiresPurpose` e marcar o inteiro teor digital de imóveis, o papel de segurança e as opções novas
- [x] 1.2 Criar as opções de breve relato e inteiro teor no RTD e no RCPJ, e de ato notarial e testamento em Notas
- [x] 1.3 Marcar o óbito de `rcpn-certidao` para a gratuidade com inteiro teor
- [x] 1.4 Estender `asksPurpose` com a opção, o ato da gratuidade e o tipo de certidão
- [x] 1.5 Recusar em `actRules` o motivo que não foi perguntado
- [x] 1.6 Constantes do rótulo, do exemplo e do aviso da LGPD

## 2. Telas e PDF

- [x] 2.1 Campo no site, fora e dentro do bloco da gratuidade, limpo quando some
- [x] 2.2 Campo no balcão, com o tipo de certidão e a opção da gratuidade controlados
- [x] 2.3 Rótulo e edição no detalhe do pedido, com `purposeFor` olhando a gratuidade
- [x] 2.4 Rótulo "Motivo do pedido" no PDF
- [x] 2.5 Política de privacidade

## 3. Testes e conferência

- [x] 3.1 Testes do catálogo, do formulário, da edição e do PDF
- [x] 3.2 Conferir no navegador o site e o balcão em um tenant de teste, sem gravar pedido em produção
- [ ] 3.3 Avisar as serventias da exigência nova, junto com o aviso pendente de `certidoes-de-inteiro-teor`
- [ ] 3.4 Arquivar depois de `certidoes-de-inteiro-teor`, que mexe no mesmo requisito do catálogo
