import type { NextConfig } from "next"

const config: NextConfig = {
  devIndicators: false,
  // "Work" is now "Your tasks" (v4). Old links keep working; temporary, so a browser never caches the move.
  async redirects() {
    return [
      { source: "/work", destination: "/tasks", permanent: false },
      { source: "/work/:caseId", destination: "/tasks/:caseId", permanent: false },
    ]
  },
}

export default config
