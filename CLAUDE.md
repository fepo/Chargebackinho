# Contestação SaaS

Stack: Next.js 15, React 19, TS, Tailwind, Anthropic API, Pagar.me v5.
Exports: docx lib + PDF manual. Storage: localStorage only.

## STRUCTURE
src/app/ → pages + api routes
src/lib/ → prompt.ts | templates/ | storage.ts | pagarme.ts | types.ts
src/types.ts → FormContestacao (source of truth)

## PAGARME
Webhook: /api/pagarme/chargebacks → auto-preenchimento rascunho
Auto-reply: /api/pagarme/auto-respond
Validation: HMAC SHA-256, server-side only (lib/pagarme.ts)
Envs: PAGARME_API_KEY, PAGARME_WEBHOOK_SECRET

## PROMPT/CACHE
CACHED_CONTEXT (~365 tokens) + templates dinâmicos = cache_control ephemeral
Templates: desacordo_comercial | produto_nao_recebido | fraude | credito_nao_processado
Entry: buildPrompt() em prompt.ts (usado em 3 lugares)

## LOCALSTORAGE KEYS (imutáveis)
contestacao_rascunhos | contestacao_form_autosave | contestacao_last_save_time
Max 50 rascunhos. Auto-save 30s. Timestamps ISO string.

## CONVENTIONS
- "use client" em todo componente interativo
- Named exports de src/lib/* (exceto default de prompt.ts)
- FormContestacao em tudo; sem Date objects no storage
- No var; destructuring first; const para mutações
- Webhook sempre retorna 200 (Pagar.me reenvia em loop)

## COMMON MISTAKES
- Esquecer "use client" em páginas interativas
- Adicionar campo em FormContestacao sem atualizar src/types.ts
- Usar SYSTEM_PROMPT (deprecated) em vez de CACHED_CONTEXT
- Modificar estrutura de chat sem atualizar cache_control
- localStorage keys sem prefix (colisão)

## DO NOT TOUCH
- src/types.ts (quebra API contract)
- CACHED_CONTEXT structure (afeta cache hits)
- Template type names (mapeados no webhook)
- buildPrompt() signature
- /api/gerar e /api/pagarme/* (dependências webhook)
