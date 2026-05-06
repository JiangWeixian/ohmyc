// Pino logger setup — daily-rotated file logs under $OHMYC_HOME/logs (defaults to ~/.config/ohmyc/logs) with optional console output.
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

import pino from 'pino'

// Build the real pino logger lazily. This matters because the pino-roll
// transport runs `mkdir: true` on `$OHMYC_HOME/logs` and we must not create
// that directory before `migrateLegacyHome()` has had a chance to rename
// `~/.cui` into place — otherwise the migration sees the target dir and
// silently skips, orphaning the legacy data.
let cached: pino.Logger | undefined

function build(): pino.Logger {
  // Detect test or CI environment so parallel test runs do not contend for the same log file / symlink.
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST
  const isCI = process.env.CI === 'true'

  const ohmycHome = process.env.OHMYC_HOME || path.join(homedir(), '.config', 'ohmyc')
  const logDir = isTest || isCI
    ? path.join(ohmycHome, 'logs', `test-${process.pid}`)
    : path.join(ohmycHome, 'logs')
  const logFile = path.join(logDir, 'ohmyc.log')

  mkdirSync(logDir, { recursive: true })

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

  return pino({ name: 'ohmyc' }, pino.transport({ targets }))
}

function get(): pino.Logger {
  return (cached ??= build())
}

// Plain object (not Proxy) so that vi.spyOn(logger, 'info') works in tests.
// Each method is an own property that defers logger construction until the
// first call — which is always after `migrateLegacyHome()` has run.
export const logger = {
  info: ((...args: Parameters<pino.Logger['info']>) => get().info(...args)) as pino.Logger['info'],
  error: ((...args: Parameters<pino.Logger['error']>) => get().error(...args)) as pino.Logger['error'],
  warn: ((...args: Parameters<pino.Logger['warn']>) => get().warn(...args)) as pino.Logger['warn'],
  debug: ((...args: Parameters<pino.Logger['debug']>) => get().debug(...args)) as pino.Logger['debug'],
  fatal: ((...args: Parameters<pino.Logger['fatal']>) => get().fatal(...args)) as pino.Logger['fatal'],
  trace: ((...args: Parameters<pino.Logger['trace']>) => get().trace(...args)) as pino.Logger['trace'],
  child: ((...args: Parameters<pino.Logger['child']>) => get().child(...args)) as pino.Logger['child'],
}

export default logger
