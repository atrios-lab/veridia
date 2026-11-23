# Assinatura com certificado A3 (token ou cartão)

Decisão de 11/11/2026: além do A1 guardado na plataforma, o cartório assina
com certificado A3. Isso vale para os tokens e cartões já instalados no
computador e para os que forem instalados depois.

## Como funciona

O navegador não acessa o token sozinho. Por isso existe o **Assinador
Veridia**, um programa pequeno para Windows que fica no computador do
cartório (código em `tools/assinador-local`).

1. No painel, em Utilitários › Assinador digital, a pessoa escolhe
   "Certificado A3 (token ou cartão)". O formulário começa só com os
   arquivos e essa escolha: o seletor do A1 e a senha aparecem apenas
   depois que a pessoa escolhe "Certificado A1".
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

1. Baixe o instalador no próprio painel (botão "Baixar o Assinador Veridia",
   arquivo `/downloads/InstalarAssinadorVeridia.exe`) e abra. O endereço
   antigo, `/downloads/AssinadorVeridia.exe`, leva ao instalador.
2. O Windows pode avisar "O Windows protegeu o computador" (programa sem
   assinatura de código). Clique em "Mais informações" e em "Executar assim
   mesmo". O aviso some quando a Átrios comprar um certificado de assinatura
   de código e assinar o instalador e o programa.
3. O instalador põe o programa em `%LOCALAPPDATA%\VeridiaAssinador`, só para
   este usuário e sem pedir administrador. Cria o atalho "Assinador Veridia"
   no menu Iniciar, liga ao iniciar o Windows (opção marcada, que a pessoa
   pode desmarcar) e abre o programa no fim. O log fica em
   `%APPDATA%\VeridiaAssinador\assinador.log`.
4. O navegador (Chrome ou Edge) pode perguntar se o site pode acessar
   dispositivos da rede local. A resposta é Permitir.

Para atualizar, basta abrir o instalador da versão nova: ele fecha o
Assinador aberto, troca o programa e abre de novo. Isso vale também para as
versões até a 1.1.0, que se instalavam sozinhas na mesma pasta.

Para desinstalar: Configurações › Aplicativos › Aplicativos instalados ›
Assinador Veridia › Desinstalar. O desinstalador fecha o programa, tira o
atalho e a entrada do início do Windows e pergunta se apaga também as
configurações (sites autorizados, log e, numa estação de assinatura, a
ligação com a plataforma). A resposta padrão é Não. Uma estação desinstalada
deve ser desligada também no painel, em Configurações › Certificados.

### Antivírus

Até a versão 1.1.0, o programa se copiava sozinho para a pasta do usuário,
se ligava ao iniciar o Windows e se reabria, sem perguntar. Antivírus tratam
esse comportamento como suspeito. Desde a 1.2.0, quem instala é o
instalador, com as telas de sempre e desinstalação pelo Windows.

O Kaspersky acusou `UDS:DangerousObject.Multi.Generic`. Essa detecção vem da
nuvem da Kaspersky (KSN) e marca arquivos pouco conhecidos, sem reputação.
O que resolve:

1. Assinar o instalador e o programa com certificado de assinatura de código.
2. A cada versão nova, mandar os dois arquivos para reanálise como falso
   positivo no portal da Kaspersky (opentip.kaspersky.com) e no da Microsoft
   (Microsoft Security Intelligence, envio de arquivo como desenvolvedor).
3. Enquanto isso, num Kaspersky com administração central, o responsável pode
   marcar o programa como confiável (pelo hash ou pelo caminho
   `%LOCALAPPDATA%\VeridiaAssinador\AssinadorVeridia.exe`). Não desligue a
   proteção.

Drivers antigos que só falam a CryptoAPI e não fazem SHA-256 recebem a
mensagem "atualize o driver". Os tokens e cartões atuais usam a CNG, que
funciona direto.

## Compilar

```bash
scripts/build-assinador.sh
```

O script testa, roda o `go vet` para Windows e gera dois arquivos:

- `tools/assinador-local/dist/AssinadorVeridia.exe`: o programa, com Go 1.24.7;
- `public/downloads/InstalarAssinadorVeridia.exe`: o instalador, com Inno
  Setup 6.5.4, a partir de `tools/assinador-local/instalador/AssinadorVeridia.iss`.

No Linux, o Inno Setup roda no Wine: o `scripts/inno-setup.sh` baixa a
versão fixa do GitHub, confere o SHA-256 e instala em `~/.cache/veridia-inno`
(precisa de `wine`, `wine64`, `wine32:i386` e `xvfb`). No Windows, passe o
compilador em `ISCC`, por exemplo
`ISCC="/c/Program Files (x86)/Inno Setup 6/ISCC.exe" scripts/build-assinador.sh`.

As duas compilações são reproduzíveis. O CI roda
`scripts/build-assinador.sh --check`, que falha se um dos dois arquivos
guardados não for exatamente o deste código. Ao mudar o programa, suba a
versão (`Versao`, em `servidor.go`): ela vai para o instalador e para a
lista de aplicativos do Windows.

Ainda não testado com token físico: o primeiro uso real no cartório deve
ser acompanhado. Os testes cobrem o protocolo (servidor local com token
simulado, em Go) e a plataforma (preparar e finalizar, com chave fora da
plataforma, conferidos também pelo OpenSSL).
