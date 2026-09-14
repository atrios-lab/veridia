## REMOVED Requirements

### Requirement: Stub de consulta de protocolo
**Reason**: A consulta do cidadão já existe e está pronta em `/acompanhar` — não é mais um stub
"em construção". A home aponta o campo de busca para `/acompanhar` (ver capability
`citizen-tracking-entry`), então este requisito, que descrevia `/protocolo` como destino
provisório enquanto a consulta "não existe", deixa de ser verdade.
**Migration**: Nenhuma migração de dados ou configuração necessária. O comportamento do campo de
busca da hero passa a ser coberto pelo requisito "Pontos de entrada do site sempre apontam para
/acompanhar" da capability `citizen-tracking-entry`.
