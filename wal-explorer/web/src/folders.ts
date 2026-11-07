import type { InspectionMode } from './types'

export function matchesMode(file: { name: string }, mode: InspectionMode): boolean {
  return mode === 'wal' ? file.name.toLowerCase().endsWith('.wal') : file.name === 'db' || file.name.toLowerCase().endsWith('.db')
}
export function groupInstanceFolders<T extends { name: string; webkitRelativePath: string }>(files: T[], mode: InspectionMode): { name: string; files: T[] }[] {
  const groups = new Map<string, T[]>()
  for (const file of files) {
    const parts = file.webkitRelativePath.split('/')
    if (parts.length < 3 || !matchesMode(file, mode)) continue
    const name = parts[1]
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name)!.push(file)
  }
  return [...groups].map(([name, files]) => ({ name, files }))
}

export async function readDroppedDirectory(entry: FileSystemEntry, parent = ''): Promise<File[]> {
  const path = `${parent}${entry.name}`
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))
    Object.defineProperty(file, 'webkitRelativePath', { value: path, configurable: true })
    return [file]
  }
  if (!entry.isDirectory) return []
  const reader = (entry as FileSystemDirectoryEntry).createReader()
  const files: File[] = []
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
    if (!batch.length) break
    for (const child of batch) files.push(...await readDroppedDirectory(child, `${path}/`))
  }
  return files
}
