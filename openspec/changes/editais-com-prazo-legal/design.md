## Contexto

`office_publications` já guardava tipo (`kind`), setor, datas de entrada e saída e um anexo opcional. A vigência é calculada na leitura (`src/core/publications/state.ts`). A única regra legal de datas era a de proclamas (15 dias), em `expiry.ts`.

## Decisões

### Tipo de edital é uma chave de catálogo, e a regra mora no núcleo

A coluna nova `notice_type` guarda só a chave (`usucapiao-notificacao`, `loteamento`...). Cada regra (dispositivo legal, número de publicações, intervalo, carência, prazo e forma de contagem) fica em `src/core/publications/notice-types.ts`. Corrigir uma regra é mudar código revisado, não dado gravado, e as publicações já existentes passam a seguir a regra corrigida.

Banns recebem sempre `proclamas-casamento` e aviso nunca tem tipo, escritos pelo schema, como o setor.

### Datas calculadas na leitura, com a 1ª publicação como única data gravada

`noticeSchedule(regra, 1ª publicação)` devolve as publicações e o fim do prazo. Nada é gravado por tarefa: a "republicação" é o site perceber, no dia da 2ª publicação, que ela começou. Ele mostra "2ª publicação" com a data dela e devolve o cartão ao topo da página inicial. A data de saída continua gravada e editável; o formulário só a pré-preenche com o fim do prazo.

### Contagem: dias úteis por padrão

O art. 9º, § 3º, da Lei 6.015/1973 (Lei 14.382/2022) manda contar os prazos dos registros públicos pelos critérios do CPC: dias úteis, excluído o dia do começo e incluído o do vencimento, com vencimento em dia não útil prorrogado. É a mesma escolha de `deadlineDate` para os pedidos. Exceções:
- Lei 6.766, art. 19: a lei diz "dias corridos".
- Proclamas: o prazo é do Código Civil (art. 1.527).

Intervalo de 1 entre publicações significa o dia seguinte no calendário ("dias consecutivos"). Intervalos maiores contam como o prazo (os 15 dias de cada publicação na usucapião, os 15 dias úteis da adjudicação).

Feriados: só os nacionais (`nationalHolidays`). Feriado municipal ou estadual não entra; o operador corrige a saída.

### Catálogo (pesquisado em 07/11/2026 no texto federal e no CNN, Prov. CNJ 149/2023 atualizado até o Prov. 258/2026)

| Chave | Dispositivo | Publicações | Prazo | Contagem |
|---|---|---|---|---|
| `proclamas-casamento` | CC 1.527; LRP 67 § 1º | 1 | 15 dias | corridos |
| `usucapiao-terceiros` | LRP 216-A § 4º; CNN 413 | 1 | 15 dias da publicação | úteis |
| `usucapiao-notificacao` | LRP 216-A § 13; CNN 408 | 2, a 2ª quando acaba o prazo da 1ª | 15 dias após a 2ª | úteis |
| `retificacao-confrontante` | LRP 213 II §§ 2º e 3º | 2, em dias seguidos (a lei não fixa intervalo) | 15 dias após a 2ª | úteis |
| `loteamento` | Lei 6.766 art. 19 | 3 em dias consecutivos | 15 dias após a última | corridos (expresso) |
| `lote-intimacao` | Lei 6.766 arts. 32 § 1º e 49 § 2º | 3 (na forma do art. 19) | 30 dias, começando 10 dias após a última | úteis |
| `alienacao-fiduciaria` | Lei 9.514 art. 26 §§ 1º e 4º | mínimo de 3 dias | 15 dias após a última | úteis |
| `hipoteca-execucao` | Lei 14.711 art. 9º § 1º, remete à 9.514 art. 26 | mínimo de 3 dias | 15 dias após a última | úteis |
| `adjudicacao-compulsoria` | LRP 216-B; CNN 440-S e 440-X | 2, com intervalo de 15 dias úteis | 15 dias úteis após a 2ª (o CNN não fixa o termo) | úteis (expresso) |
| `bem-de-familia` | LRP 261 e 262 | 1 | 30 dias da publicação | úteis |
| `protesto-intimacao` | Lei 9.492 arts. 12 a 15 | 1 (tabelionato e CENPROT) | pagamento até o dia do edital; protesto no 1º dia útil seguinte (art. 13) | úteis |

Sem prazo federal fixo, e por isso fora do catálogo ("Outro (sem prazo calculado)"): RTD e RCPJ.

### Pontos em que a lei é ambígua (decisões registradas)

- **Proclamas:** o CC 1.527 ainda diz 15 dias, mas a LRP 67 § 1º (Lei 14.382/2022) passou a pedir publicidade eletrônica e certificado em até 5 dias. Parte da doutrina (RECIVIL, 2023) entende que os 15 dias deixaram de existir. Mantidos os 15 dias, que já eram o comportamento do sistema; o texto da regra avisa o operador.
- **Usucapião, terceiros:** o caput do CNN 413 conta "nos quinze dias subsequentes ao da publicação"; o § 2º fala em "após o decurso do prazo do edital". Contamos da publicação.
- **Retificação e adjudicação:** a lei ou o CNN não fixam de quando conta o prazo no edital. Contamos da última publicação, a leitura mais favorável ao notificado.
- **Fiduciária e hipoteca:** "período mínimo de 3 dias" foi lido como três dias seguidos de publicação.
- **Protesto:** o CNN fala em 10 dias úteis para o AR voltar; a Lei 9.492 (14 § 5º) diz 7. Isso não muda o edital em si, mas o texto cita a lei.

### Anexo servido para qualquer tipo

A rota passou para `/publicacoes/[id]/arquivo`, sem `requireSection("editais")`: aviso é conteúdo da home, e uma serventia sem a seção de editais também publica aviso com imagem. O controle continua sendo a vigência (só serve o que está em `livePublications`). `/editais/[id]/arquivo` reexporta o mesmo handler para os links já compartilhados. Imagem JPEG, PNG e WebP aparece no cartão por `<img>` apontando para a rota (não `next/image`, que guardaria a imagem em cache depois da saída); HEIC e PDF viram link.

## Riscos

- Mudar uma regra do catálogo muda o prazo exibido de editais já publicados com aquele tipo. A data de saída gravada não muda sozinha.
- A contagem em dias úteis desconhece feriados locais: em dia de feriado municipal, o fim do prazo aparece um dia antes do real.
- Produção precisa da migração 0030 antes do merge (o build da Vercel não migra).
