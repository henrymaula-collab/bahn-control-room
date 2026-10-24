import { NextResponse, type NextRequest } from "next/server"

// Night lab: layouts get no searchParams, so the page's own search string travels as a request
// header (app/(control-room)/_lab/server.ts reads it). Nothing else changes.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set("x-cr-lab-search", request.nextUrl.search)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|control-room|favicon.ico|icon.svg).*)"],
}
