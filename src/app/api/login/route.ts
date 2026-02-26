import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const envPassword = (process.env.PROTECT_PASSWORD ?? "").trim();

  let password = "";
  try {
    const formData = await request.formData();
    password = (formData.get("password") as string ?? "").trim();
  } catch {
    // Fallback: parse body manually
    const text = await request.text();
    const params = new URLSearchParams(text);
    password = (params.get("password") ?? "").trim();
  }

  console.log("[LOGIN]", {
    envVarExists: !!process.env.PROTECT_PASSWORD,
    envLen: envPassword.length,
    inputLen: password.length,
    match: password === envPassword,
  });

  if (envPassword && password === envPassword) {
    const url = new URL("/", request.url);
    const response = NextResponse.redirect(url, 303);
    response.cookies.set("auth_token", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });
    return response;
  }

  // Senha errada → redireciona com query param de erro
  return NextResponse.redirect(new URL("/?error=1", request.url), 303);
}
