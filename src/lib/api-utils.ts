import { NextResponse } from "next/server";
import { auth } from "@/auth";

/** Retorna o id do usuário autenticado ou lança uma resposta 401. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  return userId;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
