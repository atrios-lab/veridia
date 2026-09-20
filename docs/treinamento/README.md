# Vídeos de treinamento

Os vídeos do módulo Treinamento são produzidos no HeyGen e publicados pela conta da Átrios em
`/admin/ajuda/gerenciar`. Este diretório guarda os roteiros, um por vídeo, para regravar ser
editar um texto e não reagendar uma gravação.

## A trilha

Na ordem em que a Visão geral apresenta a quem é novo. Cada vídeo ensina uma tela e leva o
link "Como usar esta tela" no cabeçalho dela. Curto de propósito: até quatro minutos, uma
pergunta por vídeo.

| # | Roteiro                        | Tela ensinada              | Alvo    |
|---|--------------------------------|----------------------------|---------|
| 1 | `01-primeiros-passos.md`       | nenhuma, o painel inteiro  | 2,5 min |
| 2 | `02-pedidos-de-servico.md`     | `/admin/pedidos`           | 4 min   |
| 3 | `03-agenda.md`                 | `/admin/agenda`            | 3 min   |
| 4 | `04-lgpd-e-ouvidoria.md`       | `/admin/lgpd`              | 3 min   |
| 5 | `05-atendimento-online.md`     | `/admin/atendimento`       | 3 min   |
| 6 | `06-publicacoes.md`            | `/admin/publicacoes`       | 3 min   |
| 7 | `07-configuracoes-e-usuarios.md` | `/admin/configuracoes`   | 3 min   |

Aprofundamentos (Transparência, Adequação ao Provimento, cobrança por Pix) entram depois,
fora da trilha, com "faz parte dos primeiros passos" desmarcado.

## Formato do roteiro

Cada arquivo tem três colunas por cena: **fala** (o que o avatar diz, é o que vai no campo de
script do HeyGen), **tela** (o que a gravação de tela mostra naquele trecho) e **destaque** (o
que apontar com o cursor ou o zoom). A fala é escrita para ser ouvida: frases curtas, sem
sigla que o operador não usa, sem "clique em" repetido.

## Fluxo no HeyGen

1. **Gravar a tela antes do avatar.** Suba o painel no Homolog (nunca produção: nome de
   cidadão em tela é um incidente de LGPD enquanto o vídeo existir), entre com a conta de
   demonstração e grave a sequência da coluna "tela" com o gravador do próprio HeyGen ou com o
   QuickTime. Janela em 1920×1080, zoom do navegador em 110% para o texto ler bem em 1080p.
2. **Criar o vídeo em 16:9, 1080p.** Avatar em picture-in-picture, canto inferior direito,
   pequeno: a tela é a protagonista. Voz em português do Brasil; escolha uma e use em todos os
   vídeos, a trilha soa como uma pessoa só.
3. **Colar a fala cena a cena.** Uma cena do HeyGen por linha da tabela, com a gravação de
   tela recortada no trecho correspondente. Marque as pausas com vírgula e ponto, não com
   reticências: a voz sintética lê reticências como hesitação.
4. **Legenda.** Exporte a legenda do HeyGen em SRT e converta para WebVTT, que é o formato que
   o player do painel lê:

   ```bash
   ffmpeg -i legenda.srt legenda.vtt
   ```

   Revise a legenda antes de subir: a voz sintética acerta, o reconhecimento nem sempre.
5. **Exportar em MP4 1080p.** O HeyGen já entrega H.264 com AAC. Passe uma vez pelo
   `faststart` para o player começar antes de baixar o arquivo inteiro:

   ```bash
   ffmpeg -i heygen.mp4 -c copy -movflags +faststart 01-primeiros-passos.mp4
   ```

6. **Publicar.** Em `/admin/ajuda/gerenciar`, "Novo vídeo", MP4 e VTT, título e descrição do
   roteiro, tela ensinada e "primeiros passos" conforme a tabela acima. Confira no player da
   própria tela e só então publique: rascunho ninguém vê.

## Regras que valem para todos

- Dados de demonstração só. Nomes, CPFs e protocolos são os da seed do Homolog.
- O que o vídeo mostra tem de existir no painel. Se uma tela mudar, o roteiro muda junto, e o
  vídeo é regravado; um vídeo que mostra botão que não existe mais é pior que nenhum.
- Uma tela por vídeo. Se a explicação precisa de duas telas, são dois vídeos.
