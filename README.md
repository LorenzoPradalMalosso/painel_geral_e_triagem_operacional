# INTEGRA SENAI 2026 — Sistema de Gestão de Manutenção e Chamados (EAM e Kernel)

> Repositório do Projeto Integrador da Unidade Curricular **Desenvolvimento de Soluções Web com Inteligência Artificial Generativa**, do curso de Aperfeiçoamento Profissional em Programação em Inteligência Artificial Generativa (Google Antigravity), SENAI Americana.

Este projeto propõe um MVP web responsivo para registrar, direcionar e acompanhar chamados internos de manutenção, zeladoria, vigilância e situações de risco. A jornada do projeto segue o modelo de uma fábrica de software: investigação da demanda, validação com usuários, planejamento, construção, depuração, auditoria e apresentação. A proposta prevê o uso de IA como apoio, com análise crítica e validação humana documentadas.

> O repositório inclui uma implementação web do MVP. Os itens descritos como requisitos representam o escopo definido; considere funcionalidades comprovadas quando houver evidências correspondentes.

## Sumário

- [Contexto e desafio](#contexto-e-desafio)
- [Objetivo e escopo do MVP](#objetivo-e-escopo-do-mvp)
- [Metodologia](#metodologia)
- [Jornada de desenvolvimento](#jornada-de-desenvolvimento)
- [Entregas do INTEGRA SENAI](#entregas-do-integra-senai)
- [Vídeos para o Demo Day](#vídeos-para-o-demo-day)
- [Uso responsável de IA e privacidade](#uso-responsável-de-ia-e-privacidade)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Equipe e créditos](#equipe-e-créditos)

## Contexto e desafio

A Situação de Aprendizagem descreve uma organização em que pedidos de manutenção, zeladoria, vigilância e relatos de risco são encaminhados informalmente, principalmente por grupos de mensagens. Esse fluxo pode causar perda de histórico, duplicidade, falta de responsáveis e prazos, demora na resposta e exposição de dados pessoais.

**Desafio:** investigar o fluxo operacional com usuários e desenvolver um protótipo web funcional de um Sistema de Gestão de Manutenção e Chamados Internos (EAM), com uso ético, rastreável e auditado de Inteligência Artificial Generativa.

### Restrições obrigatórias do problema

- O registro, encaminhamento e conclusão dos chamados não podem depender do WhatsApp.
- Todo chamado deve ter status identificável e responsável; nenhum pode ficar sem acompanhamento.
- O sistema deve funcionar em navegador web responsivo, sem exigir aplicativo nativo ou hardware de alto custo.
- Painéis operacionais públicos devem proteger dados pessoais, em conformidade com a LGPD.
- Toda alteração de status deve registrar quem alterou, quando e por quê.
- A abertura deve ser rápida e intuitiva; ocorrências de risco devem receber triagem prioritária.
- O sistema não substitui canais oficiais de socorro e emergência.
- A versão inicial não deve incluir rotinas financeiras pesadas ou gestão complexa de ativos.

## Objetivo e escopo do MVP

O escopo definido para o protótipo prevê três visões principais:

1. **Abertura de chamado:** solicitante, categoria, local/ambiente, descrição, prioridade e anexo de imagem simulado; ao enviar, gera protocolo único e apresenta confirmação.
2. **Painéis operacionais:** visões para Cozinha/Zeladoria, Guarita/Vigilância e Oficina/Manutenção, com protocolo, tipo, local, resumo, tempo decorrido e status. Devem minimizar dados pessoais e destacar visualmente situações de risco.
3. **Painel administrativo:** visão consolidada, filtros por setor, status e prioridade, possibilidade de redirecionar chamados, alterar status e registrar histórico auditável.

O documento propõe atualização visual automática a cada cinco segundos, armazenamento modular inicialmente em LocalStorage com estrutura preparada para SQLite e os arquivos `index.html`, `style.css` e `app.js`. Nesta versão do repositório, o código do MVP ainda não foi incluído. As funcionalidades acima descrevem os requisitos do projeto; a implementação, os testes e as validações serão apresentados quando houver evidências correspondentes.

### Benefícios esperados

- Centralizar a comunicação e preservar o histórico operacional.
- Reduzir duplicidades e encaminhar demandas ao setor adequado.
- Agilizar a triagem, com prioridade para ocorrências de risco.
- Dar visibilidade de prazos, responsáveis e ações realizadas.
- Apoiar a gestão com indicadores como tempo médio de atendimento (TMA), tempo médio de resolução (TMR) e setores mais demandados.

## Metodologia

### Fábrica de Softwares e MSEP

A Situação de Aprendizagem organiza o Projeto Integrador como uma jornada progressiva de investigação, ideação, prototipagem, validação e comunicação, alinhada à Metodologia SENAI de Educação Profissional (MSEP). O trabalho parte de um desafio industrial e articula capacidades técnicas, básicas e socioemocionais. A equipe é composta por **5 estudantes**, com orientação docente e validação consultiva do Embaixador de Negócios.

### Referência à metodologia Kernel

O projeto também toma como referência a **metodologia Kernel**, conforme a documentação pública vinculada a este trabalho. Em termos práticos, adotamos seus princípios de transformar uma demanda em etapas verificáveis, decompor o trabalho entre papéis/agentes, formalizar requisitos e artefatos, manter aprovações explícitas nos pontos importantes e exigir revisão humana, testes e rastreabilidade antes de considerar algo concluído. A IA pode propor ou acelerar trabalho, mas a equipe continua responsável por avaliar as saídas e decidir o que entra no produto.

A documentação Kernel descreve o ciclo de produto pretendido e separa especificação, implementação real e simulação; por isso, a referência é metodológica e deve ser adaptada ao escopo educacional deste MVP. **Não se afirma que este protótipo implementa a plataforma Kernel nem que cumpre automaticamente a promessa de entrega em 30 minutos.** Consulte a [metodologia Kernel](https://github.com/lanaro0108/Kernel/blob/main/docs/Metodologia.md) e o [repositório Kernel](https://github.com/lanaro0108/Kernel).

## Jornada de desenvolvimento

As seis fases abaixo organizam a jornada descrita no guia da Situação de Aprendizagem e indicam as atividades e evidências previstas para o projeto.

| Fase | Trabalho e evidências a organizar |
|---|---|
| **1. Planejamento** | Diagnóstico; pesquisa com usuários/stakeholders; benchmarking; proposta de valor e Lean Canvas; requisitos funcionais e não funcionais; modelo de dados/schema SQLite. |
| **2. Setup autônomo** | Regras de governança `.antigravityrules`; configuração `.antigravity/config.json` com MCPs e skill de auditoria; `.gitignore` e `.env.example`; ambiente protegido. |
| **3. Build** | MVP responsivo com abertura, painéis e gestão; código organizado; roteamento, status, histórico e atualização visual previstos no escopo. |
| **4. Testes, debugging e iteração** | Evidências de execução, correções de responsividade e lógica, causa raiz, iterações e validação em navegador. |
| **5. IA responsável e auditoria** | Registro de uso de IA; avaliação de XSS, LGPD, código limpo e confiabilidade; relatório de vulnerabilidades e correções. |
| **6. Entrega e apresentação** | MVP e portfólio de evidências; vídeo do protótipo de até 1min30s; pitch elevator de até 3min; apresentação em banca. |

A Situação também lista capacidades básicas (interpretação de demandas, lógica, dados, desenvolvimento web e segurança/LGPD), técnicas (requisitos, modelagem, Antigravity, MCPs/Skills, interfaces responsivas, Clean Code, depuração e auditoria) e socioemocionais (colaboração, pensamento crítico, comunicação, ética e autonomia). A equipe deve demonstrá-las nas evidências, não apenas citá-las.

## Entregas do INTEGRA SENAI

A Situação de Aprendizagem relaciona oito entregas obrigatórias. A tabela resume o conteúdo esperado e onde as evidências do projeto serão organizadas.

| Entrega | Conteúdo/evidência | Local sugerido neste repositório |
|---|---|---|
| **1. Planos pedagógicos** | Plano de Ensino da Unidade Curricular e Planos de Aula validados e assinados pelo docente e coordenação. O checklist exige validação antes da submissão. | `evidencias/` (documentos autorizados) |
| **2. Diagnóstico do problema** | Delimitação do problema operacional e evidências do contexto. | `docs/planejamento/` |
| **3. Pesquisa com usuários** | Entrevistas/stakeholders, mapa de empatia e síntese da validação do contexto. Não publique dados pessoais. | `docs/planejamento/` |
| **4. Anterioridade e benchmarking** | Pesquisa de soluções existentes, comparação e lacunas. | `docs/planejamento/` |
| **5. Proposta de valor e Lean Canvas** | Proposta de valor e Lean Canvas da solução. | `docs/planejamento/` |
| **6. Planejamento técnico e MVP** | Parte A: RF/RNF e modelagem do banco/schema. Parte B: MVP funcional, responsivo e auditado (`index.html`, `style.css`, `app.js`, conforme o roteiro). | `docs/planejamento/` e `src/` |
| **7. Uso responsável de IA** | Diário técnico contínuo com data, fase, ferramenta/agente, objetivo, prompt relevante, síntese da saída, análise/critério de validação humana, decisão e ajustes. Consolidar também auditoria técnica XSS/LGPD. | [`docs/registro-uso-ia.md`](docs/registro-uso-ia.md) e `docs/auditoria/` |
| **8. Demo Day e portfólio** | MVP, vídeo do protótipo (até 1min30s), pitch (até 3min) e portfólio essencial de evidências. | `videos/` e `evidencias/` |

### Critérios de avaliação citados no documento

- C1: relevância do problema e diagnóstico — 20%.
- C2: pesquisa e entendimento do usuário — 15%.
- C3: proposta de valor e diferenciação — 15%.
- C4: viabilidade técnica e qualidade do MVP — 20%.
- C5: processo de desenvolvimento/integração curricular e coerência metodológica — 15%.
- C6: comunicação, pitch e evidências — 10%.
- C7: integridade, autoria e uso responsável de IA — 5%.
- O regulamento também cita bônus/critérios específicos de Soluções Industriais (Art. 84).

## Vídeos para o Demo Day

Os links abaixo foram indicados para a demonstração do protótipo e o pitch do projeto. A Situação de Aprendizagem estabelece os limites de duração indicados na tabela.

| Vídeo | Limite | Link do YouTube |
|---|---:|---|
| Demonstração do protótipo | **Até 1min30s** | [Assistir no YouTube](https://youtu.be/YrmjoxPMhLk) |
| Pitch Elevator | **Até 3min** | [Assistir no YouTube](https://youtu.be/ax2NJJDVct8) |

## Uso responsável de IA e privacidade

- Não inserir dados pessoais ou sensíveis de usuários ou da empresa parceira em prompts. Usar dados sintéticos/anônimos.
- Revisar criticamente toda saída gerada; registrar aceitação, adaptação ou rejeição e a validação humana correspondente.
- Auditar risco de XSS: conteúdo fornecido por usuário não deve ser interpretado como HTML executável ao renderizar no DOM.
- Painéis públicos/setoriais devem exibir apenas as informações operacionais necessárias, sem telefone, documento, nome completo ou outros dados pessoais desnecessários.
- Registrar alterações de status com responsável, data/hora e justificativa.
- Preservar autoria e propriedade intelectual; não apresentar conteúdo de IA como validado sem revisão.
- Não versionar credenciais, arquivos `.env`, bancos locais com dados reais ou documentos que não possam ser divulgados. Usar `.env.example` apenas para nomes de variáveis sem valores secretos.
- O checklist pedagógico requer equipes de 3 a 5, termo de aceite assinado e validação consultiva do Embaixador; o parceiro não deve escrever código nem avaliar a própria equipe.

### Diário de uso de IA

O registro de uso de IA disponível em [`dLoocs/registro-uso-ia.md`](docs/registro-uso-ia.md) documenta o apoio utilizado na preparação desta documentação. Usos futuros de IA durante o desenvolvimento devem ser acrescentados pela equipe com suas respectivas validações.

## Estrutura do repositório

```text
.
├── README.md
├── Situação de Aprendizagem (SA)  INTEGRA SENAI 2026.pdf
├── docs/
│   └── registro-uso-ia.md  # Diário técnico de uso responsável de IA
├── functions/api/          # Rotas da API para Cloudflare Pages
├── migrations/             # Migrações do banco D1
├── pages/                  # Configurações estáticas do Cloudflare Pages
├── scripts/                # Scripts de build e manutenção
├── src/
│   ├── client/             # HTML, estilos e módulos da interface
│   ├── server/             # Servidor HTTP local e acesso ao SQLite
│   └── shared/             # Regras de domínio compartilhadas
└── data/                   # Banco SQLite local (ignorado pelo Git)
```

O HTML e os arquivos da interface ficam em `src/client`; o servidor local e a persistência ficam em `src/server`, e as regras compartilhadas ficam em `src/shared`. O comando `npm start` inicia o servidor local, `npm run dev:demo` inicia uma sessão demonstrativa em memória e `npm run build` prepara a saída estática em `public/`. O PDF permanece como referência da Situação de Aprendizagem. Dados pessoais e materiais sem autorização de publicação não devem ser adicionados ao repositório.

## Equipe e créditos

- **Equipe:** Lorenzo Pradal Malosso, Murilo Dovigo Bastos, Pedro Antonio Lanaro, Rian Eduardo Pereira, Kaio Martinez Jorge.
- **Docente orientador(a):** Diogo Takamori Barbosa.
- **Unidade/Escola:** SENAI Americana.
- **Referências:** [Situação de Aprendizagem — INTEGRA SENAI 2026](Situação%20de%20Aprendizagem%20%28SA%29%20%20INTEGRA%20SENAI%202026.pdf); [Projeto Kernel](https://github.com/lanaro0108/Kernel); [Metodologia Kernel](https://github.com/lanaro0108/Kernel/blob/main/docs/Metodologia.md).

---

Projeto educacional sem fins lucrativos, desenvolvido no contexto do INTEGRA SENAI 2026.


