# PROJECT

SaaS. Stack: Next.js 14 App Router, TypeScript, Prisma, PostgreSQL, Tailwind, shadcn/ui.
Payments: Pagar.me v5. Deploy: Vercel.

## COMMANDS
dev: `npm run dev` | build: `npm run build` | db: `npx prisma studio`
migrate: `npx prisma migrate dev` | lint: `npm run lint`

## STRUCTURE
app/ → routes (App Router)
app/api/webhooks/pagarme/ → webhook handler (NÃO TOCAR)
components/ → UI (shadcn/ui base)
server/ → business logic / queries
lib/ → utils, clients
prisma/ → schema + migrations

## PAGARME
API: v5 (https://api.pagar.me/core/v5)
Auth: Basic {PAGARME_API_KEY}
Webhook secret: PAGARME_WEBHOOK_SECRET
Signature header: x-hub-signature (HMAC-SHA256)
Disputes endpoint: GET /charges/{id}/disputes
Eventos mapeados: dispute.created | dispute.updated | dispute.won | dispute.lost | dispute.closed
Regra: sempre logar raw payload antes de processar. Retornar 200 mesmo em erro de processamento.

## CONVENTIONS
- Server Components default; "use client" só para interatividade
- Multi-tenant: sempre filtrar por organizationId/tenantId
- Erros: throw typed errors, nunca silent catch, nunca console.log em produção → use logger
- No `any`, no `var`; const/let, named exports, arrow functions
- Zod para validação de inputs externos

## DO NOT TOUCH
- app/api/webhooks/pagarme/route.ts
- lib/auth.ts
- prisma/migrations/
- .env (sugerir variável, não editar)

## DO NOT
- Instalar libs sem perguntar
- Usar `any` no TypeScript
- Fazer fetch direto ao Pagar.me fora de server/pagarme/
- Retornar 4xx/5xx em webhooks (Pagar.me reenvia em loop)
