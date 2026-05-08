// Pino logger setup — daily-rotated file logs under $OHMYC_HOME/logs (defaults to ~/.config/ohmyc/logs) with optional console output.
import { homedir } from 'node:os'
import path from 'node:path'

import pino from 'pino'

// Detect test or CI environment so parallel test runs do not contend for the same log file / symlink.
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST
const isCI = process.env.CI === 'true'

// In test or CI: isolate logs per PID and skip the symlink to avoid race conditions.
const ohmycHome = process.env.OHMYC_HOME ?? path.join(homedir(), '.config', 'ohmyc')
const logDir = isTest || isCI
  ? path.join(ohmycHome, 'logs', `test-${process.pid}`)
  : path.join(ohmycHome, 'logs')
const logFile = path.join(logDir, 'ohmyc.log')

// Console logging is opt-in via OHMYC_LOG_CONSOLE to keep CLI output clean.
const enableConsole = process.env.OHMYC_LOG_CONSOLE === 'true'

const targets: pino.TransportTargetOptions[] = [
  {
    target: 'pino-roll',
    options: {
      file: logFile,
      frequency: 'daily',
      mkdir: true,
      symlink: !(isTest || isCI),
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
