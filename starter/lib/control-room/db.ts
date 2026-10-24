// Database client for the control-room engine. Unlike lib/db.ts it does not
// import "server-only", so the same engine code runs inside Next.js route
// handlers and in plain tsx scripts (seed, smoke, tests, the agent CLI).

import "dotenv/config"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as dataset from "../schema"
import * as ours from "./schema"

const schema = { ...dataset, ...ours }

type Db = ReturnType<typeof drizzle<typeof schema>>
const globalForDb = globalThis as unknown as { __crDb?: { db: Db; client: postgres.Sql } }

function connect() {
  const url = process.env.DATABASE_URL ?? "postgres://controlroom:controlroom@localhost:5438/controlroom"
  const client = postgres(url, { max: 5, onnotice: () => {} })
  return { db: drizzle(client, { schema }), client }
}

// Reuse one pool across Next.js hot reloads.
const handle = globalForDb.__crDb ?? connect()
if (process.env.NODE_ENV !== "production") globalForDb.__crDb = handle

export const crDb = handle.db

/** Scripts call this at the end so the process can exit. */
export async function closeCrDb() {
  await handle.client.end({ timeout: 2 })
  globalForDb.__crDb = undefined
}
