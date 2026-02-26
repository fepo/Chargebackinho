# MEMORY — Claudião (Contestação SaaS)
> Leia no início de cada sessão. Atualize ao final.

---

## Projeto
- **Nome:** Claudião
- **Repo:** `github.com/fepo/Chargebackinho` (branch `main`)
- **Deploy:** https://teste-olive-iota.vercel.app (Vercel, projeto `teste`, auto-deploy via push)
- **Stack:** Next.js 15.5, React 19, TS, Tailwind 3, Prisma 7 + SQLite, Anthropic SDK
- **Integrações:** Pagar.me v5, Shopify Admin API (2024-10), n8n, Linketrack
- **Shopify Store:** premierman.myshopify.com
- **PRD completo:** `PRD.md`

---

## Estrutura
```
src/app/
  page.tsx              → form multi-step (contestação)
  revisar/              → revisão do texto gerado
  defesas/              → dashboard de defesas (DB)
  defesas/[id]/         → detalhe de defesa
  historico/            → tabela de chargebacks (DB)
  shopify/              → integração Shopify
  dados/                → aba unificada Pagar.me + Shopify (NEW)
  api/
    gerar/              → POST — Claude streaming (claude-opus-4-6)
    gerar-defesa/       → POST — defesa estruturada
    gerar-dossie/       → POST — dossiê completo
    dados-unificados/   → GET — combina Pagar.me chargebacks + Shopify orders (NEW)
    defesas/            → GET listar | salvar/ POST | aprovar/ POST | webhook/ POST (n8n)
    pagarme/            → chargebacks/ (webhook+GET) | list-chargebacks/ | auto-respond/
    shopify/            → webhook/ | get-order/ | enrich/
    exportar-docx/      → POST
    exportar-pdf/       → POST
    form/autofill/      → POST
src/lib/
  db.ts                 → PrismaClient lazy singleton (Proxy, better-sqlite3)
  prompt.ts             → CACHED_CONTEXT + buildPrompt()
  pagarme.ts            → PagarmeAPI client
  shopify.ts            → ShopifyAPI client (GraphQL 2024-10, corrigido)
  storage.ts            → localStorage (legado, usado no form principal)
  tracking.ts           → Linketrack
  templates/            → 4 templates por tipo de contestação
prisma/
  schema.prisma         → Chargeback, Defesa, WebhookEvent
  migrations/           → 2 migrations aplicadas
```

---

## Estado Atual ✅
- ✅ Prisma v7 + SQLite funcionando (lazy init via Proxy no db.ts)
- ✅ Build: `prisma generate && next build` (passa local e Vercel)
- ✅ Deploy Vercel OK (projeto `teste`, CLI linkado, auto-deploy via git push)
- ✅ Todas as API routes compilando
- ✅ Webhooks Pagar.me com idempotência (WebhookEvent)
- ✅ Webhook Shopify migrado para Prisma (era Vercel Blob/globalThis legado)
- ✅ API `/api/shopify/enrich` — enriquece chargeback com dados Shopify sob demanda
- ✅ Dashboard histórico com coluna Shopify + botão "Buscar" para enriquecer
- ✅ Dashboard defesas + histórico chargebacks (DB)
- ✅ Geração streaming Claude + export DOCX/PDF
- ✅ Token Shopify com escopos completos (`read_orders`, `read_customers`, `read_fulfillments` etc.)
- ✅ Aba `/dados` — visualização unificada Pagar.me + Shopify
- ✅ Matching Pagar.me↔Shopify por email + valor (com debug info)
- ✅ GraphQL queries e mapper corrigidos para Shopify API 2024-10
- ⚠️ `storage.ts` legado ainda usado no form principal (não migrado para DB)

---

## Observações de desenvolvimento (recentes)

- Local dev: existe um erro intermitente ao abrir `/api/pagarme/chargebacks` quando o adaptador SQLite tenta abrir um arquivo em um diretório que não existe. Log: `TypeError: Cannot open database because the directory does not exist` (ver `src/lib/db.ts`). Ambiente local usa `dev.db` quando `DATABASE_URL` não é um Postgres.
- Autenticação local: adicionado um middleware simples em `src/middleware.ts` que protege a UI com uma senha única (env `PROTECT_PASSWORD`). Cookie de sessão: `auth_token=authenticated`.
- Fixes recentes no middleware:
  - `httpOnly` do cookie temporariamente setado para `false` em dev para evitar problemas no localhost.
  - Evita redirect loop ao submeter a senha na rota `/` — agora, se a requisição já estiver na raiz, o middleware define o cookie e continua (usa `NextResponse.next()`), em vez de redirecionar para `/` novamente.
- Como reproduzir o fluxo de login:
  1. Rode `npm run dev`.
  2. Acesse `http://localhost:3000` em janela anônima — verá a tela "Acesso restrito".
  3. Insira a senha definida em `.env.local` (`PROTECT_PASSWORD`, valor atual: `LOFIBEATS2026`).
  4. Ao enviar, o middleware define o cookie `auth_token` e permite acesso às rotas protegidas.
- Dica: se aparecer `ERR_TOO_MANY_REDIRECTS`, abra em janela anônima e tente novamente (ou reinicie o servidor). O redirect loop foi corrigido.

---

## Shopify API — Campos 2024-10 (IMPORTANTE)
A API 2024-10 mudou nomes de vários campos GraphQL. As queries e o mapper em `shopify.ts` já foram corrigidos:
- `price` → `originalUnitPriceSet { shopMoney { amount currencyCode } }`
- `variantId` → `variant { id }` (campo direto não existe mais)
- `fulfillments` → array direto (não usa mais `edges/node`)
- `trackingInfo` → retorna array (antes era objeto único)
- `taxPriceSet` → `totalTaxSet`
- `shippingPriceSet` → `totalShippingPriceSet`
- `financialStatus` → `displayFinancialStatus`
- `fulfillmentStatus` → `displayFulfillmentStatus`

**Se trocar a versão da API, verificar esses campos novamente.**

---

## Matching Pagar.me → Shopify (como funciona)
O `/api/dados-unificados` faz matching em 3 estratégias (em ordem):
1. **Metadata:** extrai número do pedido Shopify de `charge.metadata` (raro ter)
2. **Email + valor:** busca pedidos Shopify pelo email do cliente, filtra por valor (tolerância 5%)
3. **Manual:** botão na UI para buscar por número do pedido

O `_matchDebug` em cada chargeback mostra qual estratégia funcionou e logs das tentativas.

---

## Modelos DB
**Chargeback:** id, externalId, chargeId, gateway, status, reason, tipoContestacao, valorTransacao, bandeira, finalCartao, dataTransacao, numeroPedido, nomeCliente, cpfCliente, emailCliente, enderecoEntrega, itensPedido(JSON), eventosRastreio(JSON), comunicacoes(JSON), transportadora, codigoRastreio, shopifyData(JSON), rawPayload(JSON), timestamps

**Defesa:** id, chargebackId(FK), dossie, contestacao, parecerJuridico, status(drafted/approved/submitted/won/lost), source(manual/n8n), pagarmeResponse(JSON), submittedAt, timestamps

**WebhookEvent:** id, source, eventType, externalId, payload(JSON), processed, defesaId(FK), createdAt — unique(source, externalId)

---

## Pendências (por prioridade)
| # | Fase | Status |
|---|---|---|
| 1 | Discovery + mapeamento | ✅ |
| 2 | Infra DB (Prisma + SQLite) | ✅ |
| 3 | Token Shopify com escopos | ✅ |
| 4 | Aba dados unificados (Pagar.me + Shopify) | ✅ |
| 5 | Webhook n8n — completar persistência + notificações | ⏳ |
| 6 | Retry de falha no aprovar/submeter Pagar.me | ⏳ |
| 7 | Notificações email (SMTP) + Slack | ⏳ |
| 8 | Filas assíncronas (BullMQ/Redis) | ⏳ |
| 9 | Testes (unit + integration + E2E) | ⏳ |
| 10 | Observabilidade (logs, Sentry, métricas) | ⏳ |

---

## Env Vars (`.env.local` + Vercel)
- `ANTHROPIC_API_KEY` ✅ (local + Vercel)
- `DATABASE_URL` ✅ (Neon Postgres na Vercel, SQLite local)
- `SHOPIFY_STORE_URL` ✅ premierman.myshopify.com (local + Vercel)
- `SHOPIFY_API_ACCESS_TOKEN` ✅ shpat_a81b... (local + Vercel, escopos completos)
- `PAGARME_API_KEY` ✅ (local + Vercel)
- `PAGARME_WEBHOOK_SECRET` — configurar
- `N8N_WEBHOOK_SECRET` — configurar
- `SMTP_*` / `SLACK_WEBHOOK_URL` — configurar

---

## Sessão 2026-02-22 — Resumo
1. Criada aba `/dados` com visualização unificada Pagar.me + Shopify
2. Criado `/api/dados-unificados` com matching por email + valor e debug info
3. Configurado Shopify env vars no Vercel (SHOPIFY_STORE_URL + SHOPIFY_API_ACCESS_TOKEN)
4. Atualizado token Shopify para versão com escopos completos
5. Corrigidas queries GraphQL e mapper para Shopify API 2024-10 (6 campos renomeados)
6. Verificado end-to-end: chargeback canonico@uol.com.br (R$475,20) → pedido Shopify #16632 ✅

---

## Próximo Passo
→ Fase 5: Webhook n8n — completar persistência + criar `src/lib/notifications.ts`
**→** Fase 3: completar `src/app/api/defesas/webhook/route.ts` (substituir TODOs por `prisma.defesa.update()`) + criar `src/lib/notifications.ts` (stubs email/Slack).

---

## Alterações Recentes (2026-02-22)
- `package.json`: build roda `prisma generate && next build`
- `src/lib/db.ts`: PrismaClient usa Proxy (lazy init) — evita crash no build da Vercel
- Projeto Vercel re-linkado ao `teste` (antes apontava `claude`)
- **Webhook Shopify** (`/api/shopify/webhook`) migrado de Vercel Blob/globalThis para Prisma + idempotência via WebhookEvent
- **Nova API** `POST /api/shopify/enrich` — busca pedido na Shopify por nome/email, atualiza Chargeback no DB
- **Dashboard histórico** — nova coluna Shopify (mostra status vinculação + botão enriquecer)
- PRD.md criado

---
_Última atualização: 2026-02-22_
