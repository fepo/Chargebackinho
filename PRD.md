# PRD — Claudião (Contestação SaaS)

## Visão
Plataforma web para gerar, gerenciar e submeter defesas de chargebacks automaticamente usando IA (Claude), com integrações a gateways de pagamento (Pagar.me), e-commerce (Shopify) e automação (n8n).

## Problema
Lojistas perdem chargebacks por falta de documentação estruturada e prazo curto de resposta. O processo manual é lento, repetitivo e sujeito a erro.

## Solução
1. **Receber** chargebacks via webhook (Pagar.me/Shopify) ou cadastro manual
2. **Enriquecer** com dados de pedido, rastreio e comunicações
3. **Gerar** defesa + dossiê com IA (Claude claude-opus-4-6, streaming, prompt caching)
4. **Revisar** e aprovar pelo operador
5. **Submeter** ao gateway e acompanhar resultado

## Usuário-alvo
Operadores de e-commerce (PT-BR) que lidam com chargebacks recorrentes.

## Stack
| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 App Router, React 19, Tailwind 3 |
| Backend | API Routes (Next.js), Prisma 7, SQLite |
| IA | Anthropic SDK (claude-opus-4-6), prompt caching |
| Integrações | Pagar.me v5, Shopify Admin API, n8n, Linketrack |
| Export | DOCX (docx lib), PDF (print HTML) |
| Deploy | Vercel (https://teste-olive-iota.vercel.app) |

## Funcionalidades

### Implementadas ✅
| Funcionalidade | Rota/Arquivo |
|---|---|
| Form multi-step de contestação | `/` (page.tsx) |
| Geração de defesa via Claude (streaming) | `POST /api/gerar` |
| Geração de dossiê completo | `POST /api/gerar-dossie` |
| Geração de defesa estruturada | `POST /api/gerar-defesa` |
| Revisão de texto gerado | `/revisar` |
| Export DOCX | `POST /api/exportar-docx` |
| Export PDF (HTML → print) | `POST /api/exportar-pdf` |
| Webhook Pagar.me (recebe chargeback) | `POST /api/pagarme/chargebacks` |
| Webhook Shopify (Prisma + idempotência) | `POST /api/shopify/webhook` |
| Enriquecer chargeback via Shopify | `POST /api/shopify/enrich` |
| Webhook n8n (resultado defesa) | `POST /api/defesas/webhook` |
| Listar chargebacks (Pagar.me API) | `GET /api/pagarme/list-chargebacks` |
| Dashboard de defesas | `/defesas` |
| Histórico de chargebacks (c/ coluna Shopify) | `/historico` |
| Detalhe de defesa | `/defesas/[id]` |
| Salvar defesa no DB | `POST /api/defesas/salvar` |
| Aprovar + submeter ao Pagar.me | `POST /api/defesas/aprovar` |
| Auto-respond batch (experimental) | `POST /api/pagarme/auto-respond` |
| Autofill form via pedido | `POST /api/form/autofill` |
| Buscar pedido Shopify | `GET /api/shopify/get-order` |
| Integração Shopify (página) | `/shopify` |
| Dados unificados Pagar.me + Shopify | `/dados` + `GET /api/dados-unificados` |
| Persistência SQLite + Prisma | `src/lib/db.ts` |
| Idempotência de webhooks | modelo `WebhookEvent` |
| Templates por tipo de contestação | `src/lib/templates/` |
| Prompt caching (CACHED_CONTEXT) | `src/lib/prompt.ts` |

### Pendentes ⏳
| Prioridade | Funcionalidade | Detalhe |
|---|---|---|
| P1 | Webhook defesas — notificação | Substituir TODOs por `prisma.defesa.update()` + notificar |
| P2 | Notificações (email/Slack) | Criar `src/lib/notifications.ts` |
| P2 | Retry de falha Pagar.me | `/api/defesas/aprovar` — tratar reenvio |
| P3 | Filas assíncronas | BullMQ/Redis para submissões e reprocessamento |
| P3 | Testes | Unitários + integração + E2E |
| P4 | Observabilidade | Logs estruturados, Sentry, métricas |

## Modelos de Dados (Prisma)
- **Chargeback** — dados do chargeback recebido (gateway, cliente, pedido, rastreio, status)
- **Defesa** — texto gerado, dossiê, status (drafted → approved → submitted → won/lost)
- **WebhookEvent** — log de eventos recebidos (idempotência por source + externalId)

## Tipos de Contestação
`desacordo_comercial` | `produto_nao_recebido` | `fraude` | `credito_nao_processado`

## Gateways Suportados
`pagarme` | `shopify` | `cielo` | `stone` | `rede` | `generico`

## Restrições
- Idioma: PT-BR
- Storage legado (localStorage) coexiste com Prisma — migração parcial
- Webhook handlers sempre retornam 200 (Pagar.me reenvia em loop)
- `FormContestacao` (src/types.ts) é contrato compartilhado — qualquer mudança propaga para form, templates, API routes
- `CACHED_CONTEXT` e `buildPrompt()` não devem ter sua assinatura alterada

## Auth / Local dev
- A aplicação possui um middleware de proteção simples para o ambiente local: `src/middleware.ts`.
	- A senha é controlada por `PROTECT_PASSWORD` (variável de ambiente). Exemplo local em `.env.local`: `PROTECT_PASSWORD=LOFIBEATS2026`.
	- O middleware renderiza uma página de login na primeira visita e define o cookie `auth_token=authenticated` quando a senha é validada.
	- Observação: por conveniência em desenvolvimento, o cookie `httpOnly` foi temporariamente setado para `false` e o middleware foi ajustado para evitar redirect loops ao submeter a senha na raiz (`/`).

## Deploy / CI
- O projeto é hospedado na Vercel. Ao conectar o repositório GitHub (`github.com/fepo/Chargebackinho`) ao projeto na Vercel, pushes para a branch `main` disparam builds automáticos.
- Se o deploy não ocorrer automaticamente, verifique em Settings → Git do projeto na Vercel se o repositório está corretamente ligado e com permissões concedidas ao GitHub App.

## Observações operacionais
- Em ambiente local, ao usar SQLite (arquivo `dev.db`) assegure que o diretório exista; caso contrário o adapter lança `TypeError: Cannot open database because the directory does not exist`. Para evitar esse erro, crie a pasta ou use `DATABASE_URL` apontando para um Postgres/Neon.
- Testes manuais recentes:
	- Commits feitos na branch `main` e empurrados para `origin/main`.
	- Teste de login: senha `LOFIBEATS2026` funciona; limpar cookies ou usar janela anônima força a tela de login.

