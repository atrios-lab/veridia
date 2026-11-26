## Why

A serventia pediu (25/11/2026) que cada averbação de georreferenciamento tenha um mapa, como os
sistemas que já usa, cumprindo o SIG-RI. Pediu também um mapa da cidade, para não haver
sobreposição.

## What Changes

- **Georreferenciamento e planta**, na matrícula do Livro 2:
  - **Entrada:** a planilha de vértices do Sigef (.ods, .xlsx ou .csv), o memorial em PDF, Word
    ou texto, ou o memorial colado.
  - **Leitura:** o sistema lê os vértices em coordenadas geográficas (graus, minutos e segundos)
    ou em UTM, com o fuso ou o meridiano central, no SIRGAS 2000.
  - **Conferência:** confere o fechamento e os lados que se cruzam.
  - **Cálculos:** calcula a área (ha e m²), o perímetro, o azimute e a distância de cada lado, e
    compara com a área da matrícula. O aviso começa acima de 5%; a retificação segue o art. 213.
  - **Planta:** a planta em escala (SVG, com norte e escala) sai para baixar, e o perímetro sai
    também em GeoJSON.
  - **Ligações:** o perímetro pode ser ligado à averbação e à certificação do Sigef.
  - **Apagar:** só marca o perímetro, e dá para restaurar.
- **Mapa (SIG-RI):**
  - mosaico com todos os perímetros em vigor e o número de cada matrícula;
  - sobreposições acima de 1 m² destacadas, com a área;
  - lista de matrículas rurais sem perímetro;
  - mapa inteiro em GeoJSON.
- "Como fazer" com a regra vigente:
  - Lei nº 6.015/1973, art. 176, §§ 3º a 5º;
  - Decreto nº 4.449/2002, art. 9º;
  - art. 10, na redação do Decreto nº 12.689/2025, que exige a identificação a partir de
    21/10/2029 e revogou os prazos por faixa.

## Capabilities

### Modified Capabilities
- `registro-de-imoveis`

## Impact

- Banco: migração 0088, que só cria a tabela `ri_geometries`.
- Dependência: `polygon-clipping`, para a interseção dos perímetros.
- Pendente: o envio direto ao SIG-RI depende do manual técnico da ONR.
