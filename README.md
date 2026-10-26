# CADEE - Sistema de Planejamento Acadêmico

Sistema web para planejamento e gerenciamento de grade curricular, desenvolvido para estudantes universitários da UFBA. O sistema permite visualizar disciplinas, planejar horários, acompanhar progresso acadêmico e importar histórico escolar.

Desenvolvido por Matheus Freitas (FormigTeen) e Eduarda Almeida (adaah)
Orientador: Prof. Dr. Rodrigo Rocha Gomes e Souza (rodrigorgs)

## 🚀 Tecnologias

### Frontend
- **React 18.3.1** - Biblioteca UI
- **TypeScript 5.8.3** - Tipagem estática
- **Vite 5.4.19** - Build tool e dev server
- **React Router DOM 6.30.1** - Roteamento

### UI & Estilização
- **TailwindCSS 3.4.17** - Framework CSS
- **Radix UI** - Componentes acessíveis e compostáveis
- **shadcn/ui** - Componentes UI baseados em Radix
- **Framer Motion 12.24.12** - Animações
- **Lucide React 0.462.0** - Ícones

### Estado & Dados
- **Jotai 2.16.0** - Gerenciamento de estado atômico
- **TanStack Query 5.83.0** - Cache e sincronização de servidor
- **Immer 11.1.3** - Imutabilidade
- **Axios 1.13.2** - Cliente HTTP

### Utilitários
- **date-fns 3.6.0** - Manipulação de datas
- **Fuse.js 7.1.0** - Busca fuzzy
- **Ramda 0.32.0** - Programação funcional
- **PDF.js 5.4.530** - Processamento de PDFs
- **Recharts 2.15.4** - Gráficos

## 📋 Funcionalidades

### 🏠 Página Inicial (Home)
- **Controle do Semestre**: Visualização das disciplinas planejadas para o período atual
- **Meu Progresso**: Acompanhamento do progresso acadêmico com gráficos e estatísticas
- **Resumo de Carga Horária**: Breakdown por tipo (obrigatórias, optativas, complementares)
- **Transição de Semestre**: Avanço automático para o próximo período com validação de pré-requisitos

### 📚 Catálogo de Disciplinas
- **Busca Inteligente**: Filtro por nome ou código de disciplina
- **Filtros Avançados**: 
  - Por tipo (obrigatórias, optativas, gerais)
  - Por status (disponíveis, cursadas, favoritos, ofertadas)
  - Por semestre
- **Visualização por Semestre**: Organização por período do curso
- **Indicadores de Status**:
  - 🟢 Cursada
  - 🟡 Disponível (pré-requisitos atendidos)
  - ⚪ Bloqueada (pré-requisitos pendentes)
- **Importação de Histórico**: Upload de PDF ou colagem de texto do histórico escolar
- **Detalhes da Disciplina**: Informações completas incluindo pré-requisitos, equivalências e co-requisitos
- **Sistema de Favoritos**: Marcação de disciplinas de interesse

### 📅 Planejador de Grade
- **Grade Horária Interativa**: Visualização em formato de matriz (dias × horários)
- **Adição de Turmas**: Seleção de turmas com visualização de conflitos de horário
- **Análise de Disponibilidade**:
  - Vagas totais, solicitadas e aceitas
  - Vagas reservadas para o curso
  - Nível de competição (baixo, médio, alto)
- **Filtros**:
  - Por turno (manhã, tarde, noite)
  - Por dia da semana
  - Por professor
- **Detalhes da Turma**: Informações completas incluindo professores, horários e local
- **Validação de Pré-requisitos**: Bloqueio automático de disciplinas sem pré-requisitos atendidos
- **Sistema de Favoritos**: Marcação de turmas de interesse

### ⚙️ Configurações
- **Seleção de Curso**: Escolha do programa de graduação
- **Modo de Experiência**:
  - **Simplificado**: Funcionalidades básicas de visualização
  - **Completo**: Recursos avançados de planejamento e gestão
- **Tema**: Suporte a modo claro/escuro
- **Exportar/Importar Configurações**: Backup e restauração de dados

## 🏗️ Estrutura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
│   ├── common/         # Componentes compartilhados
│   ├── disciplines/    # Componentes específicos de disciplinas
│   ├── layout/         # Layout da aplicação
│   ├── planner/        # Componentes do planejador
│   ├── progress/       # Componentes de progresso
│   ├── semester/       # Componentes de semestre
│   └── ui/             # Componentes UI base (shadcn/ui)
├── contexts/           # Contextos globais
│   └── AppContext.tsx  # Estado global da aplicação
├── hooks/              # Hooks personalizados
│   ├── useApi.ts       # Integração com API
│   ├── useMyCourses.ts # Cursos do usuário
│   ├── useMySections.ts # Turmas planejadas
│   ├── useMyPrograms.ts # Programas do usuário
│   └── ...
├── lib/                # Utilitários e helpers
├── pages/              # Páginas da aplicação
│   ├── Index.tsx       # Página inicial
│   ├── Disciplinas.tsx # Catálogo de disciplinas
│   ├── Planejador.tsx  # Planejador de grade
│   ├── Configuracoes.tsx # Configurações
│   └── NotFound.tsx    # Página 404
├── services/           # Serviços externos
│   └── api.ts          # Cliente API SIGAA
└── utils/              # Funções utilitárias
```

## 🔌 Integração com API

O sistema utiliza a API estática do SIGAA (Sistema Integrado de Gestão de Atividades Acadêmicas):

- **Base URL**: `https://FormigTeen.github.io/sigaa-static/api/v1`
- **Endpoints**:
  - `/programs.json` - Lista de programas de graduação
  - `/courses.json` - Índice de disciplinas
  - `/course/{code}.json` - Detalhes de disciplina
  - `/course/{code}/sections.json` - Turmas de uma disciplina
  - `/sections.json` - Todas as turmas disponíveis

### Dados Sincronizados
- Programas de graduação da UFBA
- Grade curricular completa
- Turmas ofertadas no período atual
- Pré-requisitos e equivalências
- Vagas e disponibilidade

## 🔐 Integração com a {sigaa} api (opcional)

Além da API estática, o CADEE pode usar a [{sigaa} api](https://github.com/ic-ufba/sigaa-ufba-api), que lê o SIGAA ao vivo. É o fork mantido pelo IC, com as adequações para a Rede IC; o projeto original é de [Caio Alcarria](https://github.com/caioalcarria/sigaa-ufba-api). Tudo é opcional: sem configurar, o sistema funciona exatamente como antes.

**Sem login (rotas públicas)**
- Ementa, carga horária e pré/co-requisitos atualizados direto do SIGAA no detalhe da disciplina (selo "SIGAA ao vivo")
- Programa da disciplina (objetivos, conteúdo, metodologia, referências)

**Com login do SIGAA (botão "Entrar com SIGAA")**
- Importação automática do histórico, no mesmo formato da importação por PDF (disciplinas cursadas, carga horária, semestres)
- Desfecho do semestre em planejamento aplicado sozinho (resolve a transição de semestre)
- CR, IAP, evolução do CR, % integralizado, obrigatórias pendentes, horas de extensão e dicas
- No Planejador: validar a grade com as regras oficiais, sugestão automática de grade e previsão de oferta
- Grade horária em `.ics` para o Google Agenda

A senha vai direto para a API e nunca é gravada no CADEE; o navegador guarda só o token da sessão (fora do backup de configurações).

### Configuração

```bash
cp .env.example .env.local
```

- **Desenvolvimento:** suba a API (`git clone https://github.com/ic-ufba/sigaa-ufba-api` e `docker compose up -d` dentro dela) e use `VITE_SIGAA_API_URL=/sigaa-api`. O Vite encaminha para `http://localhost:8000` (mude com `SIGAA_API_PROXY_TARGET`).
- **Produção:** a API roda no servidor de aplicações da Rede IC (Dokku), em `https://cadee-api.app.ic.ufba.br`; o passo a passo está em `docs/deploy-rede-ic.md` no [fork do IC](https://github.com/ic-ufba/sigaa-ufba-api). No Netlify, crie a variável `VITE_SIGAA_API_URL=https://cadee-api.app.ic.ufba.br` e refaça o deploy (ela entra no build). No servidor da API, a origem `https://cadee.netlify.app` precisa estar em `SIGAA_API_CORS`.
- **Segurança do site:** o `netlify.toml` define os cabeçalhos de segurança e uma CSP em modo Report-Only. Depois de alguns dias sem violações no console, troque `Content-Security-Policy-Report-Only` por `Content-Security-Policy`. Se o endereço da API mudar, atualize o `connect-src`.

Arquivos principais: `src/services/sigaaApi.ts` (cliente), `src/hooks/useSigaa.ts` (login, sincronização, consultas), `src/lib/sigaaSync.ts` (conversão para o formato do CADEE) e `src/components/sigaa/`.

## 🏠 Hospedar o site na Rede IC (opcional, substitui o Netlify)

O site também pode rodar no Dokku da Rede IC, em `https://cadee.app.ic.ufba.br`, ao lado da API. Os arquivos já estão no repositório:

| arquivo | pra quê |
|---|---|
| `Dockerfile` | compila o app (Node 22) e serve só o `dist/` com nginx sem root, na porta 8080 |
| `deploy/nginx/default.conf` | rotas do React Router caem no `index.html`; cache longo só em `/assets/` |
| `deploy/nginx/security-headers.conf` | os mesmos cabeçalhos de segurança do `netlify.toml` (a CSP recebe o endereço da API no build) |
| `app.json` | healthcheck do Dokku em `/` |
| `.github/workflows/deploy-rede-ic.yml` | build a cada push e, quando ligado, `git push` automático pro Dokku |

**Passo a passo**

1. No chamado ao suporte do IC, peça também a aplicação **`cadee`**: build por Dockerfile e portas `http:80:8080 https:443:8080`.
2. Na API, libere a nova origem (as duas durante a migração): `SIGAA_API_CORS=https://cadee.netlify.app,https://cadee.app.ic.ufba.br`.
3. Crie uma chave só para o deploy automático e mande a pública ao suporte:
   ```bash
   ssh-keygen -t rsa -b 4096 -f cadee-deploy -N "" -C cadee-github
   ssh-keyscan -p 9999 app.ic.ufba.br > known_hosts_ic
   ```
4. No GitHub (*Settings → Environments*), crie o environment `rede-ic` com os segredos `DOKKU_SSH_KEY` (conteúdo de `cadee-deploy`) e `DOKKU_KNOWN_HOSTS` (conteúdo de `known_hosts_ic`). Depois apague os dois arquivos do computador.
5. Em *Settings → Secrets and variables → Actions → Variables*, crie `DEPLOY_REDE_IC = true`. A partir daí, cada push na branch principal publica o site; também dá para rodar à mão em *Actions → deploy-rede-ic → Run workflow*.

Deploy manual, sem a Action: `git remote add dokku dokku@app.ic.ufba.br:cadee` e `git push dokku HEAD:master` (com o `~/.ssh/config` do guia do IC).

**Antes de desligar o Netlify:** o progresso de cada aluno fica no `localStorage` do navegador, que é separado por endereço. Quem usa `cadee.netlify.app` não vê os dados em `cadee.app.ic.ufba.br`. Avise com antecedência para exportarem em *Ajustes → Backup* e importarem no endereço novo (quem conectar o SIGAA recupera o histórico sozinho). Só depois troque o site do Netlify por um redirecionamento para o endereço novo.

## 🎯 Modos de Experiência

### Modo Simplificado
- Visualização básica de disciplinas
- Consulta ao catálogo
- Visualização de progresso

### Modo Completo
- Planejamento de grade horária
- Marcação de disciplinas cursadas
- Sistema de favoritos
- Importação de histórico
- Análise de competição por vagas
- Transição automática de semestre

## 💾 Persistência de Dados

O sistema utiliza `localStorage` para persistir:
- Disciplinas concluídas
- Status de disciplinas por semestre
- Turmas planejadas
- Programas selecionados
- Configurações de tema e modo
- Dados de progresso importados

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Instalação
```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

### Build para Produção
```bash
# Build
npm run build

# Preview do build
npm run preview
```

## 🎨 Características Técnicas

### Performance
- **Code Splitting**: Divisão automática de código por rota
- **Lazy Loading**: Carregamento sob demanda de componentes
- **Query Caching**: Cache inteligente de requisições API
- **Optimização de Dependências**: Pré-bundling de dependências frequentes

### Acessibilidade
- Componentes Radix UI (WCAG compliant)
- Suporte a navegação por teclado
- Tags ARIA apropriadas
- Contraste de cores adequado

### Responsividade
- Design mobile-first
- Layout adaptativo para diferentes tamanhos de tela
- Navegação otimizada para dispositivos móveis

## 📝 Funcionalidades Especiais

### Importação de Histórico
- Suporte a upload de PDF
- Parse automático de disciplinas aprovadas
- Detecção de carga horária
- Visualização prévia dos dados importados

### Análise de Competição
- Cálculo automático do nível de disputa
- Indicadores visuais (baixo/médio/alto)
- Consideração de vagas reservadas
- Histórico de solicitações

### Transição de Semestre
- Validação automática de pré-requisitos
- Detecção de disciplinas não cursadas
- Sugestão de ajustes
- Preservação de histórico

## 🛠️ Scripts Disponíveis

```bash
npm run dev      # Servidor de desenvolvimento
npm run build    # Build para produção
npm run build:dev # Build em modo desenvolvimento
npm run lint     # Executar ESLint
npm run preview  # Preview do build de produção
```

## 📄 Licença

Este projeto é privado e confidencial.

## 👥 Desenvolvimento

Desenvolvido para estudantes da Universidade Federal da Bahia (UFBA) como ferramenta de auxílio ao planejamento acadêmico.
