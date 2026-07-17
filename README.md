# Lab Prótese — SaaS para Laboratório de Prótese Dentária

Sistema completo de gestão laboratorial, com landing page, login, cadastro de clientes e pacientes, ordens de serviço (OS) com impressão e módulo financeiro.

## Funcionalidades

- **Landing page** com apresentação e links para login/cadastro
- **Autenticação** (login, cadastro, sessão JWT)
- **Dashboard** com indicadores e trabalhos recentes
- **Clientes** — dentistas e clínicas (CRO, contatos, endereço)
- **Pacientes** — vinculados aos clientes
- **Trabalhos / OS** — requisição, status, impressão da ordem de serviço
- **Financeiro** — receitas, despesas, contas pendentes e saldo mensal

## Requisitos

- Node.js 18+
- npm

## Instalação

```bash
cd lab-protese-saas
npm install
npm run db:push
npm run db:seed
npm run dev
```

Acesse: http://localhost:3000

**Publicar de novo (GitHub + Neon + Vercel):** [DEPLOY.md](./DEPLOY.md)

### Credenciais iniciais

Defina no `.env` antes do seed:

- `SEED_SENHA_PROPRIETARIO` (mín. 8 caracteres)
- `MASTER_ADMIN_PASSWORD` (mín. 8 caracteres)

Não use senhas padrão (`789654` / `admin123`) — o seed rejeita.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run db:push` | Cria/atualiza o banco SQLite |
| `npm run db:seed` | Dados de demonstração |

## Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS 4
- Prisma + SQLite
- Autenticação com JWT (cookies httpOnly)

## Estrutura

```
src/app/
  page.tsx          → Landing
  login/            → Login
  cadastro/         → Registro
  app/              → Área logada
    clientes/
    pacientes/
    trabalhos/      → Lista, nova OS, detalhe, imprimir
    financeiro/
```

## Impressão de OS

Na lista ou detalhe do trabalho, clique em **Imprimir OS**. A página abre em layout otimizado para impressão (A4).
