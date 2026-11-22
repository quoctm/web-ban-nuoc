import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sessionClient, siteUrl } from "@/lib/supabase/session";

export async function GET(request: NextRequest) {
  const client = await sessionClient();
  if (!client) return new NextResponse(null, { status: 404 });

  const code = z.string().min(1).max(2048).safeParse(request.nextUrl.searchParams.get("code"));
  if (code.success) {
    const { error } = await client.auth.exchangeCodeForSession(code.data);
    if (!error) return NextResponse.redirect(siteUrl() + "/tai-khoan/don-hang");
  }
  return NextResponse.redirect(new URL("/dang-nhap?loi=that-bai", request.nextUrl));
}
