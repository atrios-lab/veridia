## Why

A lista do que levar vinha só do catálogo da plataforma. Muitos cartórios já têm o próprio
checklist (em PDF ou na folha do balcão) e pedem itens que o catálogo não tem, ou não pedem
alguns que ele tem.

## What Changes

- **Editor da lista por serviço** (`/admin/agenda/configuracao/lista/<serviço>`), aberto pelo
  "O que levar" de cada serviço na configuração: corrigir o texto, excluir qualquer item
  (inclusive documento com foto, CPF e comprovante), acrescentar itens e "Voltar à lista
  padrão". Uma lista igual à padrão não é guardada como alteração.
- **Lista própria do cartório:** anexar um PDF ou foto do checklist do cartório, trocar ou
  tirar. O cidadão recebe o link "Baixar a lista do cartório para este serviço" ao escolher o
  serviço e na confirmação, e o endereço vai no e-mail e no comprovante em PDF.
- Serviços próprios da serventia passam a usar o mesmo editor (o campo de texto da
  configuração sai).
- `/agendar/lista/<serviço>` entrega o arquivo, procurado pela configuração da agenda; sem
  arquivo, 404.

## Não-objetivos

- Banco: nada muda. A lista e a referência ao arquivo ficam na configuração da agenda (JSON);
  o arquivo vai para o mesmo armazenamento dos anexos das publicações.
- Apagar arquivos: um arquivo trocado ou tirado deixa de ser oferecido, mas não é apagado do
  armazenamento.
