## ADDED Requirements

### Requirement: O cartório edita a lista do que levar e anexa a própria

Cada serviço SHALL ter um editor da lista do que levar, em que a serventia SHALL poder
corrigir, excluir (inclusive os itens comuns a todos os serviços) e acrescentar itens, e
voltar à lista padrão. A serventia SHALL poder anexar, trocar e tirar um PDF ou imagem com a
lista própria do cartório. Uma lista sem nenhum item e sem arquivo SHALL ser recusada. Um
arquivo trocado ou tirado SHALL deixar de ser oferecido sem ser apagado do armazenamento.

#### Scenario: Cartório tira um item e acrescenta outro

- **WHEN** a serventia exclui "Este comprovante de agendamento" e acrescenta "Taxa da certidão paga no caixa" na 2ª via de certidão e salva
- **THEN** o site, o e-mail e o comprovante mostram a lista assim

#### Scenario: Voltar à lista padrão

- **WHEN** a serventia escolhe "Voltar à lista padrão"
- **THEN** o serviço volta a seguir a lista do catálogo
