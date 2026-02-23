/**
 * Middleware de proteção por senha simples.
 *
 * Apenas verifica o cookie de autenticação.
 * O login é processado pela API route /api/login.
 *
 * Rotas ignoradas: /api/*, /_next/*, favicon.ico e assets estáticos.
 */

import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "auth_token";
const COOKIE_VALUE = "authenticated";

function loginPage(error = false): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Acesso restrito</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; font-family: system-ui, -apple-system, sans-serif; }
    .card { background: #fff; border-radius: 12px; padding: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); max-width: 360px; width: 100%; }
    h1 { font-size: 1.25rem; font-weight: 600; color: #1e293b; margin-bottom: .5rem; }
    p { font-size: .875rem; color: #64748b; margin-bottom: 1.5rem; }
    input[type="password"] { width: 100%; padding: .625rem .75rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: .875rem; outline: none; transition: border .15s; }
    input[type="password"]:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }
    button { width: 100%; margin-top: .75rem; padding: .625rem; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-size: .875rem; font-weight: 500; cursor: pointer; transition: background .15s; }
    button:hover { background: #4f46e5; }
    .error { color: #ef4444; font-size: .8rem; margin-top: .5rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Acesso restrito</h1>
    <p>Digite a senha para continuar.</p>
    <form method="POST" action="/api/login">
      <input type="password" name="password" placeholder="Senha" autofocus required />
      <button type="submit">Entrar</button>
      ${error ? '<p class="error">Senha incorreta.</p>' : ""}
    </form>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export function middleware(request: NextRequest) {
  // Verifica cookie
  const cookie = request.cookies.get(COOKIE_NAME);
  if (cookie?.value === COOKIE_VALUE) {
    return NextResponse.next();
  }

  // Sem cookie → mostra login (com erro se veio redirecionado)
  const hasError = request.nextUrl.searchParams.get("error") === "1";
  return loginPage(hasError);
}

export const config = {
  matcher: [
    "/((?!api|_next|favicon\\.ico|.*\\.).*)",
  ],
};
