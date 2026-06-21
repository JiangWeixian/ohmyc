#!/usr/bin/env node

import { spawn } from 'node:child_process'
import net from 'node:net'

const HOST = '127.0.0.1'
const DEFAULT_PORT = 1420
const DEFAULT_SCAN_LIMIT = 20

const requestedPort = parsePort(process.env.OHMYC_DESKTOP_PORT, 'OHMYC_DESKTOP_PORT')
const scanLimit = parsePort(process.env.OHMYC_DESKTOP_PORT_SCAN_LIMIT, 'OHMYC_DESKTOP_PORT_SCAN_LIMIT') ?? DEFAULT_SCAN_LIMIT
const startPort = requestedPort ?? DEFAULT_PORT

const port = await findAvailablePort({
  startPort,
  scanLimit: requestedPort ? 1 : scanLimit,
})

const devUrl = `http://${HOST}:${port}`
const beforeDevCommand = `pnpm exec vite --host ${HOST} --port ${port} --strictPort`

if (port === DEFAULT_PORT) {
  console.log(`[desktop] starting dev server at ${devUrl}`)
} else {
  console.log(`[desktop] port ${DEFAULT_PORT} is unavailable; starting dev server at ${devUrl}`)
}

const config = JSON.stringify({
  build: {
    devUrl,
    beforeDevCommand,
  },
})

const child = spawn(
  'pnpm',
  ['tauri', 'dev', '--config', config, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: process.env,
  },
)

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

function parsePort(value, name) {
  if (value == null || value === '') {
    return undefined
  }

  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`[desktop] ${name} must be an integer between 1 and 65535; received ${JSON.stringify(value)}`)
    process.exit(1)
  }
  return port
}

async function findAvailablePort({ startPort, scanLimit }) {
  const attempts = Math.max(1, scanLimit)
  for (let offset = 0; offset < attempts; offset += 1) {
    const port = startPort + offset
    if (port > 65535) {
      break
    }

    if (await isPortAvailable(port)) {
      return port
    }
  }

  const endPort = Math.min(startPort + attempts - 1, 65535)
  const range = startPort === endPort ? String(startPort) : `${startPort}-${endPort}`
  console.error(`[desktop] no available dev-server port found in ${range}`)
  console.error('[desktop] stop the process using the port, or set OHMYC_DESKTOP_PORT to a free port')
  process.exit(1)
}

function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
        resolve(false)
        return
      }
      reject(error)
    })

    server.once('listening', () => {
      server.close(() => resolve(true))
    })

    server.listen({ host: HOST, port })
  })
}
