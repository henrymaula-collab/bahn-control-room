// The chat CLI (scripts/chat.ts) with the demo depth installed first, for
// checking the five demo cases before the chat route installs it itself.
//   npx tsx lib/demo/chat-cli.ts CD-420442 --person p-sofie "What exactly did the seller write?" --provider claude-code
// Same arguments and output as scripts/chat.ts.

import "dotenv/config"
import { installDemoDepth } from "./overlay"

installDemoDepth()
void import("../../scripts/chat")
