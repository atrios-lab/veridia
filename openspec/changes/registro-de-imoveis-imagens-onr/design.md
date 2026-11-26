## Decisões

- **Padrão de imagem:** o principal do manual (Padrão 12). É o mais simples: um arquivo por matrícula, pasta por milhar. A pasta do CSL2 está vazia, então não há padrão antigo para seguir.
- **Word:** o servidor da Vercel não tem LibreOffice, por isso o .docx não é convertido "como está". Há duas rotas:
  1. **Recomendada:** ler o texto do Word (abertura e atos) e montar a ficha no layout do sistema, com a assinatura no lugar certo. Assim a assinatura sempre cai certa e a imagem sai uniforme.
  2. **Fiel ao Word:** o funcionário salva o Word como PDF e anexa o PDF. O sistema converte a página como ela é.
  
  As duas ficam disponíveis. O Word segue a rota 1.
- **PDF para imagem:** um renderizador de PDF em WebAssembly (sem binário instalado), com cada página binarizada a 200 dpi e gravada em TIFF G4.
- **Assistente virtual:** só confere e aponta. A decisão é sempre do funcionário.
