## Why

- **Segundo fator:** quem tivesse o login de um funcionário e a senha do certificado conseguia assinar.
- **Verificação pública:** a página de verificação não tinha limite de consultas.
- **Nomes repetidos:** todo documento entregue ao cidadão aparecia como "documento-final", repetido a cada
  arquivo.

## What Changes

- **Código de confirmação ao assinar.** Toda assinatura exige um código de 6 dígitos enviado ao e-mail do
  painel de quem assina, além do login e da senha do certificado. Vale para o Assinador, a coassinatura e a
  entrega ao cidadão.
  - O código vale 10 minutos e serve para todas as assinaturas feitas nesse tempo.
  - Ele fica ligado à pessoa e à serventia, por um cookie assinado e protegido.
  - Não guarda nada no banco.
  - Cinco códigos errados bloqueiam a pessoa por 10 minutos.
- **Limite em /verificar.** São 30 consultas ou downloads por endereço a cada 10 minutos. Abrir a página não
  conta.
- **Nome dos documentos entregues.**
  - O campo opcional "Nome do documento" traz sugestões a partir do ato e do protocolo: certidão, traslado,
    escritura, guia, boleto, recibo, nota de exigência.
  - Sem nome, o documento sai como "Documento final · REQ...", depois "Documento final 2 · REQ..." e assim
    por diante.
  - Cada documento entregue pode ser renomeado.
  - O cidadão vê o nome. As entregas antigas aparecem como "Documento final".
- O download do painel aceita nomes com acento sem quebrar o cabeçalho HTTP (RFC 6266).
- **Banco:** nenhuma migração.
