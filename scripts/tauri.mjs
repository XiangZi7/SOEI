import process from 'node:process'
import { readFile } from 'node:fs/promises'
import { run } from '@tauri-apps/cli'

const args = process.argv.slice(2)
const separator = args.indexOf('--')
const cliArgs = separator === -1 ? args : args.slice(0, separator)
let server

try {
  if (
    cliArgs[0] === 'dev' &&
    !cliArgs.some(arg => ['--help', '-h', '--version', '-V'].includes(arg))
  ) {
    const { createServer } = await import('vite')
    server = await createServer()
    await server.listen()
    server.printUrls()

    const devUrl =
      server.resolvedUrls.local[0] ?? server.resolvedUrls.network[0]
    if (!devUrl) throw new Error('Vite did not provide a development URL')

    const config = JSON.parse(
      await readFile(
        new URL('../src-tauri/tauri.conf.json', import.meta.url),
        'utf8'
      )
    )
    const devCsp = Object.fromEntries(
      config.app.security.csp
        .split(';')
        .map(directive => directive.trim().split(/\s+/))
        .filter(([name]) => name)
        .map(([name, ...sources]) => [name, sources])
    )
    devCsp['connect-src'].push(new URL(devUrl).origin.replace(/^http/, 'ws'))

    // Start Vite first so Tauri receives the bound port, with no second dev server.
    args.splice(
      separator === -1 ? args.length : separator,
      0,
      '--config',
      JSON.stringify({
        build: { beforeDevCommand: null, devUrl },
        app: { security: { devCsp } },
      })
    )
  }

  await run(args, 'pnpm tauri')
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await server?.close()
}
