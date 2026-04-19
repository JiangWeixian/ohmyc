import { startServer, type StartServerOptions } from './server/index';
import open from 'open';

export interface LaunchOptions {
  defaultPort?: number;
  apiOnly?: boolean;
}

export async function launchApp(options: LaunchOptions = {}): Promise<void> {
  const serverOptions: StartServerOptions = {
    defaultPort: options.defaultPort ?? 3000,
    apiOnly: options.apiOnly,
  };

  console.log('Starting ClaudeUI server...');

  try {
    const result = await startServer(serverOptions);

    const url = `http://localhost:${result.port}`;

    if (result.fallback) {
      console.log(`ClaudeUI is ready at ${url} (port ${serverOptions.defaultPort} was busy, using ${result.port})`);
    } else {
      console.log(`ClaudeUI is ready at ${url}`);
    }

    if (!options.apiOnly) {
      console.log(`Opening browser...`);
      await open(url);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to start ClaudeUI: ${message}`);
  }
}
