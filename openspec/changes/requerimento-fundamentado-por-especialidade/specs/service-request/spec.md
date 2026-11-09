## ADDED Requirements

### Requirement: Requerimento fundamentado por especialidade

O requerimento em PDF de qualquer ato SHALL ser redigido como peça dirigida ao oficial ou
tabelião da especialidade do ato, com: a qualificação do requerente; o pedido formal de prática
do ato, com o fundamento da provocação; a descrição da especialidade e sua base legal; o
princípio da instância, dizendo que a serventia é inerte e só pratica o ato quando provocada; o
texto do requerente, entre aspas e sem alteração; a fundamentação legal do ato por extenso, com
as normas da especialidade e as gerais (Constituição Federal, Lei 8.935/1994, Código Nacional de
Normas, Código de Normas da corregedoria do estado, LGPD); e o fecho "Termos em que pede
deferimento.", com cidade, UF e data. No pedido de gratuidade, o ato requerido SHALL ser o
ato-alvo, com o seu fundamento.

#### Scenario: Registro de Imóveis

- **WHEN** o cidadão pede o registro de um título no Registro de Imóveis
- **THEN** o requerimento se dirige ao "Oficial de Registro de Imóveis", cita os arts. 13 e 217 da Lei n. 6.015/1973 e os arts. 1.227 e 1.245 do Código Civil

#### Scenario: Texto do requerente

- **WHEN** o cidadão escreve "Queremos casar em outubro" na descrição
- **THEN** o requerimento traz "Dos fatos, nas palavras do requerente" com “Queremos casar em outubro.”

#### Scenario: Notas

- **WHEN** o cidadão pede uma escritura
- **THEN** o requerimento se dirige ao "Tabelião(ã) de Notas" e diz que o tabelião é inerte e atua mediante solicitação das partes (Lei n. 8.935/1994, art. 6º, I)
