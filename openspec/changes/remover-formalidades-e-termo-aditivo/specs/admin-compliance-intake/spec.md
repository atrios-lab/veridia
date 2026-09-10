## MODIFIED Requirements

### Requirement: Coleta em seções com salvamento por campo
O painel SHALL oferecer, a quem tem `content.edit`, o módulo "Adequação ao Provimento" com 16 seções, uma por tela, na ordem do brief. Cada campo SHALL ser salvo no servidor ao ser deixado (texto) ou alterado (escolha), sem botão de salvar. A tela inicial SHALL mostrar o progresso "N de 16 seções", a lista das seções com o estado em palavra (não iniciada, em andamento, concluída) e um botão que leva à seção aberta mais recentemente editada.

#### Scenario: Resposta sobrevive a sair e voltar
- **WHEN** a titular marca "Windows 10" na Seção 8, fecha o navegador e reabre a Seção 8 em outro aparelho
- **THEN** "Windows 10" está marcado e a lista mostra a Seção 8 como "em andamento"

#### Scenario: Continuar de onde parei
- **WHEN** a serventia editou a Seção 10 ontem e a Seção 7 hoje, ambas incompletas
- **THEN** o botão da tela inicial leva à Seção 7

### Requirement: Perfil Átrios e exportação
Dentro do painel da serventia, a conta `superadmin` SHALL ver, além do que a serventia vê, as pendências detectadas, os "não sei" e o botão "Exportar JSON". A rota de exportação SHALL recusar qualquer outro perfil e SHALL devolver o arquivo `<slug>.json` no vocabulário do gerador, sem edição manual e sem os campos de formalidades (data de assinatura, numeração de portaria, marca do documento) nem o de envio do termo aditivo aos fornecedores, que deixaram de fazer parte da coleta.

#### Scenario: Exportar é só da Átrios
- **WHEN** a titular abre a tela inicial do módulo
- **THEN** não há botão "Exportar JSON", e um GET direto em `/admin/adequacao/exportar` devolve 403

#### Scenario: JSON não traz mais formalidades nem termo aditivo
- **WHEN** o perfil Átrios exporta o JSON de uma serventia
- **THEN** o arquivo não contém as chaves `aditivo_fornecedores`, `num_portaria_ultima`, `num_portaria_inicial`, `data`, `data_curta` nem `sem_marca`
