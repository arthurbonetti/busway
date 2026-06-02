# Busway

Sistema web de transporte publico com autenticacao, acompanhamento de rotas, paineis por perfil (usuario, motorista e administrador), controle financeiro e suporte a PWA.

## Sumario

- [Visao geral](#visao-geral)
- [Principais funcionalidades](#principais-funcionalidades)
- [Arquitetura e stack](#arquitetura-e-stack)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Fluxo de autenticacao e perfis](#fluxo-de-autenticacao-e-perfis)
- [Colecoes esperadas no Firestore](#colecoes-esperadas-no-firestore)
- [PWA e funcionamento offline](#pwa-e-funcionamento-offline)
- [Boas praticas e seguranca](#boas-praticas-e-seguranca)
- [Autores](#autores)

## Visao geral

O Busway centraliza operacoes de mobilidade urbana em uma unica aplicacao web:

- Cadastro e login com email/senha ou Google.
- Direcionamento automatico por perfil apos autenticacao.
- Gestao de usuarios, rotas, motoristas e feedbacks para administradores.
- Acompanhamento de dados financeiros para usuarios.
- Estrutura preparada para uso como Progressive Web App (PWA).

## Principais funcionalidades

### Usuario

- Cadastro e login.
- Consulta de saldo e historico de transacoes.
- Recarga de saldo.
- Navegacao por paginas publicas (rotas, historico, configuracoes e localizacao simples).

### Motorista

- Dashboard dedicado para operacao.
- Pagina de localizacao em tempo real.
- Vinculacao com rotas definidas pela administracao.

### Administrador

- Painel unificado com abas de rotas, usuarios, motoristas, feedbacks e configuracoes.
- Criacao e edicao de usuarios com suporte a atribuicao de multiplas rotas para motoristas.
- Monitoramento de status operacional de motoristas.

### Financeiro

- Controle financeiro integrado ao Firestore.
- Atualizacao em tempo real de saldo e transacoes.
- Filtros e visualizacao de movimentacoes.

## Arquitetura e stack

- Front-end: HTML, CSS e JavaScript vanilla.
- Backend as a Service: Firebase Authentication + Cloud Firestore.
- SDK Firebase: versao 8 via CDN.
- PWA: `manifest.json` + `service-worker.js`.
- Servidor local: `python3 -m http.server` (ou alternativa com `npx serve`).

## Estrutura do projeto

Principais diretorios:

- `pages/public`: telas publicas e onboarding.
- `pages/user`: area do usuario final.
- `pages/driver`: area operacional do motorista.
- `pages/admin`: painel administrativo.
- `pages/finance`: modulo financeiro.
- `js/services`: integracoes com Firestore.
- `js/utilities`: utilitarios compartilhados.
- `styles/global`: estilos globais e dark mode.

Arquivos de destaque:

- `index.html`: landing page.
- `login.html`: autenticacao.

## Fluxo de autenticacao e perfis

Ao autenticar, os dados do usuario sao lidos do Firestore e a navegacao e direcionada por permissao:

- `isAdmin = true` -> painel administrativo.
- `isDriver = true` ou `role = driver` -> painel de motorista.
- Demais casos -> painel de usuario.

## Colecoes esperadas no Firestore

Com base na implementacao atual, o projeto trabalha principalmente com:

- `users`
- `transactions`
- `favorites`
- `trips`

Dependendo dos modulos administrativos e de rastreamento ativos, outras colecoes podem ser utilizadas.

## PWA e funcionamento offline

O projeto inclui artefatos de PWA:

- `manifest.json` para metadados de instalacao.
- `service-worker.js` para gerenciamento de cache e atualizacao.

## Autores

- Arthur Bonetti
- Matheus Valdameri Bichara
- Murilo Schneider
- Pedro Henrique Gasparetto


