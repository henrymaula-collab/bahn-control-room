import { NextResponse, type NextRequest } from "next/server"

// /lab/as?person=kaisa&to=/tasks/...: signs in as that person (the demo cookie) and opens the page.
export function GET(request: NextRequest) {
  const person = request.nextUrl.searchParams.get("person") ?? "aino"
  const to = request.nextUrl.searchParams.get("to") ?? "/"
  // The request's own host (127.0.0.1), so the cookie set here is sent with the redirect.
  const origin = `${request.headers.get("x-forwarded-proto") ?? "http"}://${request.headers.get("host") ?? request.nextUrl.host}`
  const res = NextResponse.redirect(new URL(to.startsWith("/") ? to : "/", origin))
  res.cookies.set("cr-person", person, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 })
  return res
}
