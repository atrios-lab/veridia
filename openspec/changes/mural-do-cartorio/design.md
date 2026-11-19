## Context

A Equipe do cartório já mostra como guardar pessoas, fotos e PDFs com controle do que é público. O mural repete o desenho para notícias, sem reaproveitar as tabelas: uma notícia tem várias fotos e um texto longo, e a pessoa tem um nível e uma ordem.

As publicações formais (`publications`) têm tipo, entrada e saída, e os anexos são apagados 30 dias depois. Fotos e PDF do mural não podem herdar essa regra.

## Goals / Non-Goals

**Goals:**
- O cartório publica notícias sem depender de um desenvolvedor, com texto, fotos e PDF.
- Nenhum dado pessoal fica público por descuido: foto exige autorização registrada, PDF exige confirmação.
- Nada é apagado do banco.

**Non-Goals:**
- Agendamento por data, comentários, integração com redes sociais.

## Decisions

### 1. Duas tabelas próprias

`office_news` guarda a notícia (tipo por id, data, resumo, texto, marcas `published` e `image_consent`, arquivamento). `office_news_files` guarda cada foto e o PDF, com `removed_at`: retirar um arquivo mantém a linha e apaga só o arquivo guardado. Alternativa descartada: colunas de foto na notícia, que limitariam a uma foto.

### 2. Tipos fixos

Casamento comunitário, Evento social, Correição e Outras notícias vivem no código. Alternativa descartada: tipos editáveis como os níveis da equipe, sem ganho para um mural de quatro assuntos.

### 3. O que o site serve

As rotas públicas de arquivo só entregam arquivo de notícia publicada e não arquivada; a foto só com `image_consent`. Tudo o mais é "não encontrado". Cache de 5 minutos, para que retirar a autorização valha em poucos minutos. O caminho do arquivo nunca chega ao navegador.

### 4. Correição

O Livro de Visitas e Correições é escriturado pela autoridade judiciária (CNN, art. 187, parágrafo único), e a correição anual verifica a adaptação à LGPD (art. 105). O painel mostra o aviso quando o tipo é Correição: a notícia informa a visita, sem dados pessoais nem o conteúdo da ata. O CNN compilado não traz regra específica de publicidade do cartório nas redes; o texto do mural é informativo.

### 5. Link no menu só com conteúdo

Como na Equipe, a seção é sempre ligada, mas o link do menu e do rodapé só aparece com ao menos uma notícia publicada. A página continua respondendo, com um texto de "ainda não há notícias", para quem chegar pelo endereço.

## Risks / Trade-offs

- **Foto de terceiros.** A caixa de autorização é declaratória: o painel não verifica a autorização. O texto manda guardar as autorizações (LGPD).
- **PDF público com dado pessoal.** O painel avisa e exige a confirmação a cada anexo, e anexar é registrado na auditoria como "atenção".
