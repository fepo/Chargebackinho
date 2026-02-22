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
| Persistência SQLite + Prisma | `src/lib/db.ts` |
| Idempotência de webhooks | modelo `WebhookEvent` |
| Templates por tipo de contestação | `src/lib/templates/` |
| Prompt caching (CACHED_CONTEXT) | `src/lib/prompt.ts` |

### Pendentes ⏳
| Prioridade | Funcionalidade | Detalhe |
|---|---|---|
| P1 | Token Shopify completo | Escopos: `read_orders`, `read_customers`, `read_fulfillments` |
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
