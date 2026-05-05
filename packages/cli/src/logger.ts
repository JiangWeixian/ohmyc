import { homedir } from 'node:os'
import path from 'node:path'

import pino from 'pino'

// Detect test environment
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST

// In test environment, use a temp log path and disable symlink
// to avoid race conditions when tests run in parallel
const logDir = isTest
  ? path.join(homedir(), '.cui', 'logs', `test-${process.pid}`)
  : path.join(homedir(), '.cui', 'logs')
const logFile = path.join(logDir, 'ohmyc.log')

// Check if console output is enabled via env var
// Default: disabled (only file logging), enable with OHMYC_LOG_CONSOLE=true
const enableConsole = process.env.OHMYC_LOG_CONSOLE === 'true'

const targets: pino.TransportTargetOptions[] = [
  {
    target: 'pino-roll',
    options: {
      file: logFile,
      frequency: 'daily',
      mkdir: true,
      symlink: !isTest,
    },
    level: 'info',
  },
]

if (enableConsole) {
  targets.push({
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
    level: 'info',
  })
}

const transport = pino.transport({ targets })

export const logger = pino(
  {
    name: 'ohmyc',
  },
  transport,
)

export default logger
