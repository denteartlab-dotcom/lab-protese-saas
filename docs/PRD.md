# PRD — Lab Prótese SaaS (DenteArt Lab)

**Produto:** Plataforma SaaS multi-tenant para gestão de laboratórios de prótese dentária  
**Domínio:** [denteartlab.com.br](https://www.denteartlab.com.br)  
**Versão do documento:** 1.0  
**Base:** código em produção no repositório `lab-protese-saas`  
**Última atualização:** junho/2026

---

## Índice

1. [Visão do produto](#1-visão-do-produto)
2. [Personas e usuários](#2-personas-e-usuários)
3. [Modelo de negócio (SaaS)](#3-modelo-de-negócio-saas)
4. [Arquitetura e requisitos não funcionais](#4-arquitetura-e-requisitos-não-funcionais)
5. [Módulos funcionais](#5-módulos-funcionais)
6. [Integrações](#6-integrações)
7. [Fluxos críticos](#7-fluxos-críticos)
8. [Métricas de sucesso (KPIs)](#8-métricas-de-sucesso-kpis)
9. [Riscos e dependências](#9-riscos-e-dependências)
10. [Roadmap sugerido](#10-roadmap-sugerido)
11. [Glossário](#11-glossário)
12. [Referência técnica](#12-referência-técnica)

---

## 1. Visão do produto

### 1.1 Problema

Laboratórios de prótese operam com processos fragmentados: ordens de serviço em planilhas, produção sem visibilidade, financeiro desconectado da OS, estoque manual e pouca comunicação com dentistas clientes. Isso gera atrasos, retrabalho, inadimplência e perda de margem.

### 1.2 Solução

Sistema web integrado que cobre o ciclo completo do laboratório:

**cadastro → OS → produção → entrega → cobrança → relatórios**

Com multi-tenant (cada laboratório isolado), assinatura SaaS, integrações de pagamento/fiscal e portal público para clientes.

### 1.3 Objetivos de negócio

- Reduzir tempo operacional na gestão de OS e produção
- Aumentar visibilidade financeira (receber, pagar, DRE, fluxo de caixa)
- Monetizar via assinatura recorrente (Básico / Profissional / Premium)
- Escalar para múltiplos laboratórios na mesma infraestrutura
- Oferecer trial de 14 dias para conversão

### 1.4 Fora de escopo (atual)

- App mobile nativo (há flag de acesso mobile nas permissões; produto principal é web)
- ERP contábil completo (há DRE e plano de contas, não substitui contador)
- Marketplace entre laboratórios

---

## 2. Personas e usuários

| Persona | Papel no sistema | Necessidades principais |
|---------|------------------|-------------------------|
| **Proprietário do lab** | `proprietario` | Visão 360°, financeiro, configurações, usuários, assinatura |
| **Gerente** | `gerente` | Produção, relatórios, cadastros |
| **Financeiro** | `financeiro` | Contas a receber/pagar, boletos, NFS-e, conciliação |
| **Produção** | `producao` | OS, controle de etapas, agenda, módulo colaborador |
| **Usuário operacional** | `usuario` | Tarefas limitadas por permissão |
| **Colaborador de chão** | Módulo colaborador / TV | Ver ordens do setor, avançar etapas |
| **Admin da plataforma** | `MASTER_ADMIN` | Gestão de tenants, suporte, cobranças SaaS |
| **Dentista cliente** | Portal público | Acompanhar OS, marcar urgência/recebido |
| **Fornecedor** | Link público | Responder orçamento de compra |

---

## 3. Modelo de negócio (SaaS)

### 3.1 Planos

| Plano | Preço ref. | Usuários | OS/mês | Diferencial |
|-------|------------|----------|--------|-------------|
| Básico | R$ 30/mês | 2 | 100 | Operação essencial |
| Profissional | R$ 40/mês | 5 | 500 | Escala média |
| Premium | R$ 50/mês | Ilimitado | Ilimitado | Completo |

- Cobrança **mensal ou anual** (desconto 10–15%)
- **Trial:** 14 dias Premium no cadastro público
- Pagamento via **PIX** (Mercado Pago preferencial, Asaas fallback)
- Bloqueio em `/assinatura-vencida` quando vence; login permitido para renovar

### 3.2 Receita do laboratório (B2B2C)

Além da assinatura SaaS, o laboratório usa o sistema para:

- Boletos/PIX Asaas para clientes dentistas
- NFS-e (Plugnotas ou Nuvem Fiscal)
- Faturas e extratos públicos por link

### 3.3 Ciclo de vida da assinatura

| Etapa | Comportamento |
|-------|---------------|
| Cadastro | Trial Premium 14 dias, `status: ativo` |
| Uso normal | Acesso completo conforme plano e permissões |
| Vencimento | Redirecionamento para `/assinatura-vencida` |
| Renovação PIX | +30 ou +365 dias; empilha se ainda vigente |
| Inadimplência prolongada | Bloqueio; cron pode excluir conta após 30+ dias sem acesso e sem pagamento |

---

## 4. Arquitetura e requisitos não funcionais

### 4.1 Stack tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind |
| Backend | API Routes Next.js + `server.ts` (Socket.IO) |
| Banco | PostgreSQL + Prisma 6 |
| Auth | JWT em cookie httpOnly |
| Estado/config | JsonStore por tenant (sync cliente ↔ servidor) |
| Deploy | VPS Ubuntu, Nginx, PM2, Let's Encrypt |

### 4.2 Multi-tenant

- Cada laboratório = entidade `Empresa` com `slug` único
- URLs: `/app/{slug}/clientes`, `/app/{slug}/financeiro`, etc.
- Isolamento por `empresaId` em entidades relacionais
- Sessão JWT vinculada ao slug — sem acesso cross-tenant
- Configurações flexíveis em `JsonStore` com prefixo `t:{empresaId}:`

### 4.3 Autenticação e permissões

**Sessão tenant**

- Cookie `lab-protese-session`, JWT HS256, 7 dias (30 com “lembrar”)
- Login: e-mail + senha (bcrypt)
- Mesmo e-mail em vários labs → seletor de laboratório (HTTP 409)

**Papéis**

- `proprietario`, `gerente`, `usuario`, `financeiro`, `producao`
- Proprietário recebe todas as permissões automaticamente

**Permissões granulares**

- Por item de menu: `ver`, `criar`, `editar`, `excluir`
- Filtro por setores de produção
- Flags: retiradas carteira, alterar PIX, alterar senha, acesso mobile

**Admin master**

- Modelo `MasterUser`, cookie separado
- Painel `/admin-master`, role `MASTER_ADMIN`

### 4.4 Requisitos não funcionais

| Requisito | Critério |
|-----------|----------|
| Disponibilidade | App + Nginx + PM2 com restart automático |
| Segurança | HTTPS, cookies secure em produção, bcrypt, isolamento tenant |
| Performance | Gzip Nginx, bootstrap cacheado, PM2 com memória adequada |
| Backup | Automático diário (disco + Google Drive + OneDrive opcional) |
| Renovação SSL | `certbot.timer` + hook reload Nginx |
| Tempo real | Socket.IO para TV produção e chat suporte |
| Idiomas | PT, EN, ES |
| Tema | Claro/escuro persistido |

> **Importante:** produção deve usar `npm run start` (`server.ts` + Socket.IO). `next start` quebra TV e tempo real.

---

## 5. Módulos funcionais

### 5.1 Landing e onboarding

**Rotas:** `/`, `/cadastro`, `/login`, `/recuperar-senha`, `/redefinir-senha`, `/termos`, `/privacidade`

| Funcionalidade | Descrição |
|----------------|-----------|
| Landing marketing | Hero, benefícios, planos, CTA WhatsApp |
| Cadastro | Verificação e-mail (Resend), senha forte, termos, cria empresa + proprietário |
| Trial automático | 14 dias Premium |
| Login | Branding por laboratório (logo/slug), lembrar senha |
| Recuperação senha | E-mail com token |

**Critérios de aceite**

- Cadastro cria tenant isolado com defaults de configuração
- Usuário logado na landing redireciona para `/app`
- Assinatura vencida redireciona para renovação, não para o app

---

### 5.2 Dashboard (Início)

**Rota:** `/app`

| Widget / área | Conteúdo |
|---------------|----------|
| Produção | OS em andamento, atrasadas, por status |
| Financeiro | Resumo receber/pagar |
| Estoque | Alertas estoque baixo/zerado |
| Clientes | Sem serviço há X dias (impressão PDF) |
| Aniversariantes | Clientes do mês |
| Uploads | Uso de armazenamento |
| Anotações | Lembretes internos |
| Busca rápida OS | Por número, código de barras ou paciente |

---

### 5.3 Produção

**Rotas:** `/app/producao/os`, `controle`, `agenda`, `modulo`, `comissao`, `finalizadores`, `entregas`, `modulo-tv`

#### Ordem de Serviço (OS)

- CRUD com segmentos: serviço, produto, transporte
- Vínculo cliente, paciente, dentes, materiais, urgência, repetição
- Tabela de preços integrada
- Baixa automática de estoque (produtos)
- Bloqueio por saldo devedor do cliente (configurável)
- Impressão OS (vários modelos)
- Histórico de etapas e retrabalho
- Anexos/imagens

#### Controle de produção

- Fluxo por etapas e setores
- Avanço de status com auditoria
- Fotos por etapa
- Integração com controle de entregas

#### Agenda de produção

- Visão semanal por colaborador/etapa
- Impressão da agenda

#### Módulo colaborador

- Visão simplificada para operador de setor
- Atualização de situação da OS
- Permissão `moduloProducao` no usuário

#### Comissões

- Cálculo por colaborador conforme regras cadastradas

#### Finalizadores

- Controle de quem finaliza cada tipo de serviço

#### Controle de entregas

- Rotas, entregadores, situações (saiu, entregue, recebido)
- Histórico com impressão PDF
- Sincronização automática com status da OS
- Link de acompanhamento para cliente

#### Módulo TV

- Painel fullscreen para chão de fábrica
- Atualização em tempo real (Socket.IO)
- Gráficos e presença de colaboradores

**Entidades principais:** `Trabalho`, `HistoricoEtapa`, `Paciente`, `Cliente` + JsonStore (etapas, setores, colaboradores, entregas)

---

### 5.4 Financeiro

**Rota:** `/app/financeiro` (abas via query string)

| Aba | Funcionalidades |
|-----|-----------------|
| Contas a receber | Faturas por cliente, parcelas, quitação, recibo, nota de cobrança |
| Contas a pagar | Despesas, fornecedores, produtos do estoque, anexos |
| Conta digital | Integração Asaas subconta |
| Boletos | Emissão e controle via Asaas |
| Plano de contas | Receitas/despesas hierárquicas, categorias em lançamentos |
| Conta bancária | Saldo, movimentações, importação OFX, Open Finance (Pluggy) |

**Capacidades adicionais**

- Vínculo OS → cobrança → fatura
- Extrato sincronizado com valor atual da OS
- 5 modelos de fatura configuráveis
- NFS-e por tenant
- Fatura/extrato públicos por token
- Visualizador PDF integrado

**Entidades:** `Lancamento`, `ContaBancaria`, `MovimentacaoConta`, `CobrancaAsaas`, `NfseEmissao`

---

### 5.5 Estoque

**Rotas:** `/app/produtos`, `/app/orcamentos`

| Funcionalidade | Descrição |
|----------------|-----------|
| Catálogo | Produtos com custo, estoque mínimo, categorias |
| Movimentações | Entrada/saída manual e via OS |
| Etiquetas | Impressão por categoria |
| Orçamentos | Pedido a fornecedor com link público de resposta |
| Aplicação | Ao aprovar orçamento, atualiza custo e estoque |
| Alertas | Dashboard e notificações de estoque baixo |

**Entidades:** `Produto`, `Orcamento`

---

### 5.6 Cadastros

| Cadastro | Capacidades |
|----------|-------------|
| Clientes | PF/PJ, CRO, descontos, representante, entrega, import Excel, WhatsApp acompanhamento |
| Pacientes | Vinculados ao cliente dentista |
| Colaboradores | Setor, comissão, carga horária, remuneração |
| Fornecedores | Dados fiscais e contato |
| Prestadores | Serviços terceirizados |
| Entregadores | Rotas de entrega |
| Tabela de preços | Itens para OS, impressão |
| Setores | Cores para produção/TV |
| Etapas | Fluxo produtivo, tempo médio, prazo |
| Material dentista | Tipos de material enviado pelo cliente |

---

### 5.7 Relatórios

| Relatório | Objetivo |
|-----------|----------|
| Fluxo de caixa | Entradas/saídas por período |
| DRE | Demonstrativo de resultado |
| Margem de contribuição | Rentabilidade por serviço/cliente |
| Produção | Volume e status |
| Tempo de produção | Dias parado por etapa/OS |
| Curva ABC clientes | Classificação por faturamento |
| Controle de entregas | Performance logística |
| Estoque | Posição e movimentação |
| Recibos emitidos | Histórico de recebimentos |
| Logs de auditoria | Rastreabilidade de ações |
| Dashboard gerencial | Visão consolidada |
| Relatório financeiro geral | Consolidado |
| Clientes negativos | Clientes com prejuízo |
| Serviços não concluídos | OS paradas há muito tempo |

**Padrão:** filtros de período, exportação CSV/Excel, impressão via PDF viewer.

---

### 5.8 Configurações

**Rota:** `/app/configuracoes`

| Área | Conteúdo |
|------|----------|
| Dados do laboratório | Razão social, CNPJ, endereço, contatos |
| Logomarca / cabeçalho | Logo para OS, faturas, login |
| Idioma e região | PT/EN/ES, moeda, país |
| Horário de funcionamento | Regras operacionais |
| NFS-e | Credenciais Plugnotas/Nuvem Fiscal |
| Boletos Asaas | API key, ambiente |
| Gerais | Comportamentos globais (status OS, entregas automáticas, etc.) |
| Modelos OS | 5 layouts de impressão |
| Modelos faturas | 5 layouts |
| Etiquetas | Layout de etiquetas de produto |
| Usuários | CRUD + matriz de permissões |
| Backup | Manual, automático, restauração, Google Drive |

---

### 5.9 Portal público

| Rota | Função |
|------|--------|
| `/acompanhamento/[token]` | Cliente acompanha OS, marca urgente/recebido |
| `/orcamento/[token]` | Fornecedor responde orçamento |
| `/fatura/[token]` | Cliente vê fatura |
| `/extrato/[token]` | Cliente vê extrato financeiro |

---

### 5.10 Admin Master (plataforma)

**Rotas:** `/admin-master`, `/admin-master/empresas/[id]`, `/admin-master/suporte`

| Funcionalidade | Descrição |
|----------------|-----------|
| Dashboard | Empresas ativas, bloqueadas, inadimplentes, receita |
| Gestão de tenants | CRUD empresa, plano, limites, vencimento |
| Bloquear/reativar | Controle de acesso |
| Ativar assinatura manual | Bypass para suporte |
| Cobranças | Histórico PIX/Asaas/MP |
| Suporte | Chat em tempo real com laboratórios |
| Auditoria | Log de ações master |

---

### 5.11 Suporte e notificações

- Widget de chat in-app (laboratório ↔ master) com Socket.IO
- Sininho de notificações (OS sem nota, estoque, anotações, etc.)
- E-mail transacional (Resend): cadastro, senha, boas-vindas
- Banner de vencimento de assinatura
- Logout automático por inatividade

---

## 6. Integrações

| Integração | Uso | Obrigatória |
|------------|-----|-------------|
| PostgreSQL | Dados relacionais | Sim |
| Asaas | Boletos lab, subconta, PIX assinatura (fallback) | Parcial |
| Mercado Pago | PIX assinatura SaaS (preferencial) | Parcial |
| Resend | E-mails transacionais | Recomendada |
| Plugnotas / Nuvem Fiscal | NFS-e | Opcional por tenant |
| Pluggy | Open Finance / extrato banco | Opcional |
| Google Drive | Backup na nuvem | Opcional |
| OneDrive | Backup via rclone | Opcional |
| WhatsApp | OTP, links acompanhamento, CTA landing | Opcional |
| Socket.IO | TV + suporte | Sim (produção) |
| Let's Encrypt | HTTPS | Sim (VPS) |

---

## 7. Fluxos críticos

### 7.1 Assinatura SaaS

```
Cadastro → Trial 14d → Uso do app → Vencimento? 
  → Não: continua uso
  → Sim: /assinatura-vencida → PIX → Webhook confirma → Acesso liberado
```

### 7.2 Ciclo operacional do laboratório

```
Nova OS → Controle produção → Controle entregas → Contas a receber → Boleto/NFS-e / Fatura pública
```

### 7.3 Onboarding de tenant

```
Cadastro público → Verificação e-mail → Cria Empresa + User proprietário 
  → Provisiona JsonStore defaults → Redireciona para /app/{slug}
```

---

## 8. Métricas de sucesso (KPIs)

### Produto

- Taxa de conversão trial → pago
- Churn mensal por plano
- OS criadas por tenant/mês
- Tempo médio de OS em produção
- % de labs usando financeiro + produção juntos

### Técnico

- Uptime app (PM2 + Nginx)
- Tempo de bootstrap do laboratório
- Falhas de webhook PIX
- Renovações SSL automáticas sem intervenção

### Suporte

- Tempo médio de resposta no chat master
- Volume de conversas por módulo

---

## 9. Riscos e dependências

| Risco | Mitigação atual |
|-------|-----------------|
| JsonStore + Prisma mistos | Bootstrap sincronizado; migração gradual |
| Rotas legadas `/app/trabalhos` vs `/app/producao/os` | Documentado; unificar no futuro |
| `next start` sem Socket.IO | Deploy obriga `npm run start` via PM2 |
| README desatualizado | Este PRD + `deploy/VPS-UBUNTU.md` |
| Mesmo e-mail em vários labs | Seletor no login (409 MULTIPLAS_CONTAS) |
| Contas inativas sem pagamento | Cron limpa após 30+ dias |

---

## 10. Roadmap sugerido

Itens não implementados, priorização sugerida:

1. Unificar rotas de OS (`trabalhos` → `producao/os`)
2. App mobile / PWA dedicado para colaborador
3. API pública documentada para integrações
4. Dashboard de metas para o proprietário
5. Onboarding guiado pós-cadastro
6. Relatórios agendados por e-mail

---

## 11. Glossário

| Termo | Significado |
|-------|-------------|
| **OS** | Ordem de Serviço — trabalho/prótese solicitado pelo dentista |
| **Tenant** | Laboratório cliente do SaaS (`Empresa`) |
| **Slug** | Identificador na URL (`denteart`, `lab-silva`) |
| **JsonStore** | Armazenamento JSON por tenant para configs e cadastros flexíveis |
| **Segmento** | Tipo de item na OS: serviço, produto ou transporte |
| **Master** | Administrador da plataforma DenteArt, não do laboratório |

---

## 12. Referência técnica

### 12.1 Rotas públicas principais

| Rota | Descrição |
|------|-----------|
| `/` | Landing |
| `/login` | Autenticação |
| `/cadastro` | Criação de conta |
| `/assinatura-vencida` | Renovação de plano |
| `/pagamento` | Checkout PIX |
| `/admin-master` | Painel plataforma |

### 12.2 Menu principal do app

| Seção | Itens |
|-------|-------|
| Início | Dashboard |
| Produção | OS, Controle, Agenda, Módulo, Comissão, Finalizadores, Entregas, TV |
| Financeiro | Receber, Conta digital, Boletos, Pagar, Plano de contas, Conta bancária |
| Cadastros | Clientes, Colaboradores, Fornecedores, Prestadores, Entregadores, Tabela de preços, Setores, Material, Etapas |
| Estoque | Produtos, Orçamentos |
| Relatórios | 14 relatórios analíticos/operacionais |
| Configurações | Dados, modelos, usuários, backup, integrações |

### 12.3 Entidades Prisma principais

| Domínio | Modelos |
|---------|---------|
| Multi-tenant | `Empresa`, `User`, `SequenciaNumerica` |
| CRM | `Cliente`, `Paciente` |
| Produção | `Trabalho`, `HistoricoEtapa`, `LogAuditoria` |
| Financeiro | `Lancamento`, `ContaBancaria`, `MovimentacaoConta`, `CobrancaAsaas`, `NfseEmissao` |
| Estoque | `Produto`, `Orcamento` |
| Plataforma | `MasterUser`, `CobrancaAssinatura`, `SuporteConversa`, `SuporteMensagem` |
| Auxiliar | `JsonStore`, `ArquivoUpload`, `PasswordResetToken` |

### 12.4 Documentação relacionada no repositório

| Arquivo | Conteúdo |
|---------|----------|
| `README.md` | Visão geral (parcialmente desatualizado) |
| `DEPLOY.md` | Deploy geral |
| `deploy/VPS-UBUNTU.md` | Guia completo VPS |
| `deploy/MERCADOPAGO-ASSINATURA.md` | PIX assinatura |
| `deploy/RESEND-EMAIL.md` | E-mail transacional |
| `prisma/schema.prisma` | Modelo de dados |

---

*Documento gerado a partir do inventário do código-fonte. Atualize este arquivo quando módulos ou integrações forem adicionados ou removidos.*
