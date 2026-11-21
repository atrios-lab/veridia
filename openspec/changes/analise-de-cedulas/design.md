## Context

A Base jurídica (`core/conhecimento`, `lib/knowledge*.ts`) lê PDF, Word, ZIP e imagem, guarda só o texto e pesquisa por hierarquia das fontes. A qualificação (`core/qualificacao`, `lib/ai.ts`) já usa o assistente virtual em tarefas fixas, com aprovação humana. A revisão das notas aprende sem dados pessoais. A análise de cédulas reaproveita esses três padrões.

## A lei vigente (conferida no Planalto em 21/11/2026)

| Espécie | Ato da cédula | Garantias | Prazo | Fundamento |
|---|---|---|---|---|
| Rural Pignoratícia, Hipotecária, Pign. e Hipot., Nota de Crédito Rural (DL 167/1967) | nenhum: a inscrição foi revogada (DL 167, arts. 30 a 40, e LRP, art. 167, I, 13, revogados pela Lei 13.986/2020, art. 61) | penhor rural: registro no Livro 3 (LRP, arts. 167, I, 15, e 178, VI); hipoteca: registro na matrícula (LRP, art. 167, I, 2); alienação fiduciária de imóvel: registro na matrícula (LRP, art. 167, I, 35) | 10 dias; 5 dias para cancelamento de garantia (LRP, art. 188) | DL 167, art. 14, §§ 3º a 6º: vedado exigir documento complementar e negar o registro porque a garantia vale menos que o crédito |
| Crédito Industrial (DL 413/1969) | registro no Livro 3 (LRP, arts. 167, I, 14, e 178, II; DL 413, art. 30) | hipoteca e alienação fiduciária de imóvel na matrícula; alienação fiduciária de móvel também no RTD | 3 dias úteis (DL 413, art. 38) | averbações: DL 413, art. 36; cancelamento: art. 39 |
| Crédito à Exportação (Lei 6.313/1975) | como a industrial (art. 4º) | como a industrial | 3 dias úteis | |
| Crédito Comercial (Lei 6.840/1980) | como a industrial (art. 5º, a conferir: a página oficial não abriu) | como a industrial | 3 dias úteis | |
| Produto Rural, CPR (Lei 8.929/1994) | registro ou depósito em entidade autorizada pelo Banco Central, e não no RI (art. 12) | hipoteca, penhor rural e alienação fiduciária de imóvel no RI onde estão os bens (art. 12, §§ 1º e 2º); alienação fiduciária de produto agropecuário também no RI (art. 12, § 4º) | 3 dias úteis (art. 12, § 2º) | emolumentos como os da cédula rural (art. 12, § 3º) |
| Crédito Imobiliário, CCI (Lei 10.931/2004) | averbação da emissão na matrícula, só com número, série e instituição custodiante (art. 18, § 5º) | a garantia já registrada | 15 dias (art. 52) | ato único para emolumentos se pedido junto com a garantia (art. 18, § 6º) |
| Crédito Bancário, CCB (Lei 10.931/2004) | nenhum (art. 42) | conforme a garantia: RI ou RTD (art. 42) | 15 dias (art. 52) | CCB rural: emolumentos como os da cédula rural (art. 42-B) |
| Imobiliária Rural, CIR (Lei 13.986/2020) | registro ou depósito em entidade autorizada pelo Banco Central (art. 19) | registro do patrimônio rural em afetação na matrícula (art. 9º; LRP, art. 167, I, 47); cancelamento por averbação (art. 15) | 10 dias (LRP, art. 188) | |

## Decisions

- **A matriz é código, não configuração.** O motivo é que um erro na matriz vira um ato errado. Cada linha tem fundamento e data de conferência, e qualquer mudança passa por uma PR. Quando o Caderno IRIB nº 9 (2016) disser outra coisa, a linha leva um aviso de divergência citando o artigo novo.
- **O assistente propõe, a regra decide.** O assistente virtual extrai os dados e sugere a espécie. O plano dos atos sai sempre da função pura `planActs`, a partir dos dados conferidos. Assim, o assistente nunca inventa um livro ou um ato.
- **Modelos em palavras próprias.** Seguem a estrutura que a lei exige para o ato (título, partes, valor, vencimento, garantia, protocolo). O caderno fica só como referência citada, e nada é copiado de outro cartório. Os campos sem dado aparecem como `[preencher: ...]`.
- **O arquivo é lido e descartado**, como na Base jurídica: fica só a lista com o nome dos arquivos. Um anexo do pedido é lido do armazenamento e continua no pedido.
- **Histórico**: cada edição dos dados ou de um modelo guarda o valor anterior em `history` (até 50 entradas). Apagar marca `removed_at`, com motivo, e "Restaurar" desfaz.
- **Aprendizado**: `cueOf(title)` normaliza o título da cédula: minúsculas, sem acento, sem números e sem o que vem depois de "nº". Quando o funcionário corrige a espécie, a expressão fica ligada à espécie certa e passa a vencer a detecção por palavras-chave.
- **Acesso**: `cedulas.manage` é derivada de `desk.access`, como `messages.use`. Todos começam com ela.

## Risks / Trade-offs

- A lei pode mudar de novo. A data de conferência fica visível em cada linha, e a pesquisa da Base jurídica põe a lei acima da doutrina.
- O art. 5º da Lei 6.840/1980 não pôde ser lido na página oficial. A linha da Cédula de Crédito Comercial fica marcada "a conferir".
