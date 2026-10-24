import { NextResponse } from "next/server"

/** Shared error shape for /api/cr routes. */
export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

export async function body<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>
  } catch {
    return {}
  }
}
