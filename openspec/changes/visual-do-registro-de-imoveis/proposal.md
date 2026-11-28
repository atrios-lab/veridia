## Why

O Protocolo e as telas gerais do Registro de Imóveis cresceram por acréscimo: o trabalho do dia (a lista de títulos) ficava no fim de uma página de mais de 3.000 px, depois da impressão do livro, das folhas e dos tomos; os botões "Assinar digitalmente / Imprimir" se repetiam cerca de 20 vezes e o bloco "Quem assina" aparecia duas vezes. O cartório pediu (28/11/2026) um visual que o funcionário veja e entenda de imediato e que seja mais harmônico, com as fotos de antes e depois aprovadas.

## What Changes

- Protocolo: faixa "Hoje" no topo (dia, próximo número, folha, dias a encerrar, Encerrar e Novo protocolo), cinco números do dia com cor de significado, e abas fixas: Títulos, Encerramento dos dias, Livro, folhas e impressão, Índice. Cada aba tem endereço próprio.
- Lista de títulos com filtros rápidos (Em andamento, Vencem hoje, Em exigência, Registrados…), situação em cor sempre igual (vermelho vence/venceu, laranja exigência, azul a qualificar, verde registrado, cinza encerrado sem registro), barra de prazo só quando há prazo, e o botão da próxima ação.
- Aba Livro, folhas e impressão: os tomos em linha do tempo e um quadro único de impressão (o que, quem assina, como).
- Mesa do RI: lista "Agora" em ordem de urgência; Livros e termos com os tomos de cada livro e a coluna "A assinar"; menu agrupado em Dia a dia, Acervo, Livros e índices, Migração e ONR, Serventia, com contadores só quando há o que fazer.
- Nada muda no banco nem nos PDFs; os endereços continuam os mesmos.

## Impact

- `src/app/admin/ri/protocolo/**`, `src/app/admin/ri/page.tsx`, `src/app/admin/ri/livros/page.tsx`, o menu do RI.
- Regra pura nova `src/core/ri/protocol-view.ts` (cor e prazo de cada título), com testes.
