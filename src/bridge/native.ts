import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
export const desktop = isTauri()
export function assetUrl(path: string): string {
  return desktop && !path.startsWith('/') && !path.startsWith('blob:')
    ? convertFileSrc(path)
    : path
}
export function call<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  return invoke<T>(command, args)
}
export async function onNative<T>(
  event: string,
  handler: (payload: T) => void
): Promise<UnlistenFn> {
  return listen<T>(event, event => handler(event.payload))
}
export function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'message' in error)
    return String(error.message)
  return String(error)
}
