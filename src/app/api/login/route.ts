import { NextRequest, NextResponse } from "next/server";

const PASSWORD = process.env.PROTECT_PASSWORD ?? "minhasenha";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = (formData.get("password") as string ?? "").trim();

  if (password === PASSWORD) {
    const response = NextResponse.redirect(new URL("/", request.url));
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
  return NextResponse.redirect(new URL("/?error=1", request.url));
}
