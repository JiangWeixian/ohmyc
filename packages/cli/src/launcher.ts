import { startServer, type StartServerOptions } from './server/index';
import open from 'open';

export interface LaunchOptions {
  defaultPort?: number;
}

/**
 * Launch the ClaudeUI application.
 *
 * 1. Prints a "starting server" status message.
 * 2. Calls startServer() to bind the HTTP server.
 * 3. Prints a "ready" message with the actual URL.
 * 4. Opens the browser to the resolved localhost URL.
 * 5. On failure, prints an actionable error and exits non-zero.
 */
export async function launchApp(options: LaunchOptions = {}): Promise<void> {
  const serverOptions: StartServerOptions = {
    defaultPort: options.defaultPort ?? 3000,
  };

  // Phase 1: Starting server
  console.log('Starting ClaudeUI server...');

  try {
    const result = await startServer(serverOptions);

    // Phase 2: Server ready
    const url = `http://localhost:${result.port}`;

    if (result.fallback) {
      console.log(`ClaudeUI is ready at ${url} (port ${serverOptions.defaultPort} was busy, using ${result.port})`);
    } else {
      console.log(`ClaudeUI is ready at ${url}`);
    }

    // Phase 3: Opening browser
    console.log(`Opening browser...`);
    await open(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to start ClaudeUI: ${message}`);
  }
}
