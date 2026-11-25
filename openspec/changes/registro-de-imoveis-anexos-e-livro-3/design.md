## Decisions

- **TIFF sem fonte do servidor.** O texto vira contorno de glifo (fontkit, fonte Tinos), o desenho
  vira bitmap (sharp/libvips) e sai 1 bit G4 a 300 dpi. A lista dos "18 padrões de imagem" do ONR
  não veio nos manuais: a escolha é a usual de arquivo (TIFF G4) e deve ser confirmada com o ONR
  antes da primeira carga.
- **Imagem da assinatura não é assinatura.** Fica como aparência no papel ou na cópia de consulta;
  o ato vale assinado à mão ou com certificado ICP-Brasil (Lei nº 6.015/1973, art. 17, § 1º; Lei nº
  14.063/2020, art. 4º). Só quem cuida dos certificados cadastra a imagem.
- **Leitura é proposta.** O assistente virtual devolve JSON conferido campo a campo; o que não
  confere é descartado. Aplicar nunca sobrescreve dado salvo.
- **Livro 3 fora das cargas da ONR**, que não têm tipo de registro para ele.
