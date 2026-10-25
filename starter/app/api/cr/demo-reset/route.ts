import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { NextResponse } from "next/server"
import { fail } from "../_util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const run = promisify(execFile)

/**
 * POST /api/cr/demo-reset: the same steps as `npm run demo:reset` and `npm run db:seed:cr -- --depth-only`,
 * for recording takes without a terminal. Only when the server runs with CR_DEMO_TOOLS=1.
 * Also makes Aino the person on this screen again, since every take starts as her.
 */
export async function POST() {
  if (process.env.CR_DEMO_TOOLS !== "1") return fail("Demo tools are off", 404)
  try {
    await run("npm", ["run", "demo:reset"], { cwd: process.cwd(), env: process.env, timeout: 180_000 })
    await run("npm", ["run", "db:seed:cr", "--", "--depth-only"], { cwd: process.cwd(), env: process.env, timeout: 180_000 })
  } catch (error) {
    return fail(`Reset failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`, 500)
  }
  const response = NextResponse.json({ ok: true, at: new Date().toISOString() })
  response.cookies.set("cr-person", "aino", { path: "/", sameSite: "lax" })
  return response
}
