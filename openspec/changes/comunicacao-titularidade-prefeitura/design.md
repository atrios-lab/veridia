## Decisions

- **Leitura reaproveitada.** As partes, a matrícula, a inscrição, a descrição e o valor vêm do
  leitor das guias (`core/guides/reading.ts`); o novo núcleo (`core/titularidade`) lê o que é da
  comunicação: operação pelas palavras do título (o específico antes do geral, "adiantamento da
  legítima" antes de "doação"), data por extenso ou em números, livro e folhas, base de cálculo,
  endereço. O Word é lido do `word/document.xml`.
- **Mês do ato.** O ato entra na competência da sua data; alterar a data muda o mês.
- **Prazo.** Último dia útil do mês seguinte, com o calendário da serventia (feriados nacionais,
  dias sem expediente e folgas próprias): o caput fala em dia útil.
- **Ofício congelado.** O ofício guarda os atos como estavam ao ser gerado, para o PDF sair igual
  depois. Corrigido um ato, gera-se outro ofício; o anterior pode ser excluído com justificativa.
- **Destinatário.** Reaproveita a configuração da Declaração de ISS (Secretaria, prefeitura, CNPJ,
  endereço, prefeito e secretário), que a serventia já preenche.
- **LGPD.** O ofício diz que os dados se destinam só à atualização cadastral, sob sigilo fiscal.
