import type { NextConfig } from "next"

const config: NextConfig = {
  devIndicators: false,
  // A second dev server (own port, own database) builds into its own folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // "Work" is now "Your tasks" (v4). Old links keep working; temporary, so a browser never caches the move.
  async redirects() {
    return [
      { source: "/work", destination: "/tasks", permanent: false },
      { source: "/work/:caseId", destination: "/tasks/:caseId", permanent: false },
    ]
  },
}

export default config
