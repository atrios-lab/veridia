# Assinatura com certificado A3 (token ou cartão)

Decisão de 11/11/2026: além do A1 guardado na plataforma, o cartório assina
com certificado A3. Isso vale para os tokens e cartões já instalados no
computador e para os que forem instalados depois.

## Como funciona

O navegador não acessa o token sozinho. Por isso existe o **Assinador
Veridia**, um programa pequeno para Windows que fica no computador do
cartório (código em `tools/assinador-local`).

1. No painel, em Utilitários › Assinador digital, a pessoa escolhe
   "Certificado A3 (token ou cartão)".
2. O painel pergunta ao Assinador Veridia (`http://127.0.0.1:47820`) quais
   certificados o Windows conhece. A cada consulta ele lê o repositório
   "Pessoal" do usuário, onde o Windows coloca os certificados dos tokens e
   cartões conectados. Um token novo aparece sem configurar nada, basta o
   driver do fabricante.
3. A plataforma prepara o PDF (faixa, QR, manifesto e campo de
   assinatura), guarda essa versão por até 15 minutos e devolve só os bytes
   a assinar (os atributos assinados do CMS, com o resumo SHA-256 do
   documento).
4. O Assinador Veridia assina esses bytes no token (RSA com SHA-256). O
   driver do token pede o PIN, e **a chave nunca sai do token**.
5. A plataforma confere a assinatura com o certificado, monta o PAdES
   (mesma política AD-RB ICP-Brasil do A1), salva e registra na auditoria.
   Assinatura de outra chave, preparo vencido ou reaproveitado e pedido de
   outra pessoa são recusados sem salvar nada.

A coassinatura ("Assinar também") funciona do mesmo jeito.

## Segurança do Assinador Veridia

- Responde só no próprio computador (127.0.0.1) e recusa pedidos endereçados
  a outro nome (proteção contra *DNS rebinding*).
- Na primeira vez que um site pede os certificados, pergunta à pessoa se ele
  pode usá-los. A resposta Sim fica guardada; Não vale até fechar o programa.
- Antes de assinar, pergunta "Assinar documentos para ...?". Um lote seguido
  (2 minutos) não pergunta a cada documento. O PIN é sempre do driver.
- O painel só fala com esse endereço exato (`connect-src` em
  `src/lib/csp.ts`).
- Não fica nenhum dado do token na plataforma: a assinatura registra o nome,
  o CPF/CNPJ, o emissor e a série do certificado, sem `certificate_id`.

## Instalação no cartório

1. Baixe o programa no próprio painel (botão "Baixar o Assinador Veridia",
   arquivo `/downloads/AssinadorVeridia.exe`) e abra.
2. O Windows pode avisar "O Windows protegeu o computador" (programa sem
   assinatura de código). Clique em "Mais informações" e em "Executar assim
   mesmo". O aviso some quando a Átrios comprar um certificado de assinatura
   de código e assinar o `.exe`.
3. O programa se copia para `%LOCALAPPDATA%\VeridiaAssinador` e liga ao
   iniciar o Windows, só para este usuário e sem pedir administrador. O log
   fica em `%APPDATA%\VeridiaAssinador\assinador.log`.
4. O navegador (Chrome ou Edge) pode perguntar se o site pode acessar
   dispositivos da rede local. A resposta é Permitir.

Drivers antigos que só falam a CryptoAPI e não fazem SHA-256 recebem a
mensagem "atualize o driver". Os tokens e cartões atuais usam a CNG, que
funciona direto.

## Compilar

```bash
scripts/build-assinador.sh
```

O script testa, roda o `go vet` para Windows e gera
`public/downloads/AssinadorVeridia.exe` com Go 1.24.7. A compilação é
reproduzível. O CI roda `scripts/build-assinador.sh --check`, que falha se
o `.exe` guardado não for exatamente o deste código.

Ainda não testado com token físico: o primeiro uso real no cartório deve
ser acompanhado. Os testes cobrem o protocolo (servidor local com token
simulado, em Go) e a plataforma (preparar e finalizar, com chave fora da
plataforma, conferidos também pelo OpenSSL).
