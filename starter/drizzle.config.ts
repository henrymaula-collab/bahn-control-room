import "dotenv/config"
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  // The seeded dataset tables, plus the control room's own cr_* tables and the chat's.
  schema: ["./lib/schema.ts", "./lib/control-room/schema.ts", "./lib/chat/schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://controlroom:controlroom@localhost:5438/controlroom" },
})
