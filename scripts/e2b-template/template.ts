import { Template } from 'e2b'

// Keep template minimal and stable; runtime app code is still built per PR.
export const template = Template()
  .fromTemplate('base')
  .runCmd('corepack enable')
  .runCmd('corepack prepare pnpm@10.2.0 --activate')
