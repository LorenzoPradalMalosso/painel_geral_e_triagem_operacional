# INTEGRA EAM

Central web do SENAI 2026 para registrar, encaminhar, acompanhar e resolver chamados internos.

## Demonstração

Com Node.js 24, execute na pasta do painel:

    node server.js --demo

Abra http://127.0.0.1:4173 e escolha um perfil. Os chamados e usuários são fictícios. A demonstração fica em memória e reinicia junto com o servidor.

## Ambiente com persistência

    node server.js

Abra http://127.0.0.1:4173 e crie a primeira conta de administrador. Em **Configurações**, cadastre as demais contas e ajuste as categorias, os setores de destino e as prioridades. O servidor grava em **eam.sqlite**. Use outro caminho com **EAM_DATABASE**, se necessário. A porta padrão é 4173 e pode ser alterada com **EAM_PORT**.

- **Solicitante** abre chamados e acompanha os próprios registros.
- **Executor** acompanha a fila do seu setor e atualiza o atendimento.
- **Gestor** acompanha os setores, reatribui responsáveis e altera prioridades conforme as regras.
- **Administrador** também cadastra usuários e configura o encaminhamento.

O **painel público** fica em **/monitor** e pode abrir direto em um setor, por exemplo **/monitor?setor=Manutenção**. Sua API entrega apenas contagens por setor e etapa. As interfaces atualizam os dados a cada cinco segundos.

## Estrutura

| Arquivo | Responsabilidade |
| --- | --- |
| code.html e styles.css | Navegação, telas, diálogo, componentes e layout responsivo |
| app.js e ui.js | Sessão do navegador, eventos, filtros, renderização e exportação |
| server.js | HTTP, autenticação, validação, permissões e operações |
| domain.js e store.js | Regras dos chamados, dados de demonstração e persistência SQLite |

TMA mede da abertura ao primeiro início de atendimento. TMR mede da abertura à resolução. Ambos usam as datas gravadas no chamado. A detecção preventiva compara local normalizado, categoria e assunto em chamados ativos.

## Ambiente compartilhado

O servidor inicia no endereço de loopback. Configure a primeira conta localmente. Para disponibilizar na rede, publique atrás de um proxy HTTPS, preserve o host público nos cabeçalhos encaminhados e defina **EAM_SECURE_COOKIE=1**. Mantenha o arquivo SQLite acessível apenas ao processo do servidor e use o recurso de backup do SQLite para cópias com o sistema em operação.

O protótipo anterior guardava chamados no navegador. Esses dados permanecem no armazenamento original. Se a chave antiga estiver disponível na mesma origem, um administrador pode baixar a cópia em **Configurações → Registros do protótipo anterior**. O banco novo inicia vazio.

O cadastro, a política de retenção, as categorias, as transições e o procedimento de emergência são parâmetros a confirmar com a empresa parceira.
