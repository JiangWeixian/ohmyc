import { homedir } from 'node:os'
import path from 'node:path'

import pino from 'pino'

const logDir = path.join(homedir(), '.cui', 'logs')
const logFile = path.join(logDir, 'ohmyc.log')

const transport = pino.transport({
  targets: [
    {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
      level: 'info',
    },
    {
      target: 'pino-roll',
      options: {
        file: logFile,
        frequency: 'daily',
        mkdir: true,
        symlink: true,
      },
      level: 'info',
    },
  ],
})

export const logger = pino(
  {
    name: 'ohmyc',
  },
  transport,
)

export default logger
