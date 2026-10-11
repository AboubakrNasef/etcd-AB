import type { ChangeEvent } from 'react'
import { useAppStore } from '../store'

export function FilePanel() {
  const mode = useAppStore((state) => state.mode)
  const file = useAppStore((state) => state.file)
  const chooseFile = useAppStore((state) => state.chooseFile)
  function onChoose(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0] ?? null)
  }
  const isWal = mode === 'wal'
  return <div className="dropzone">
    <div className="file-mark">{isWal ? 'WAL' : 'DB'}</div>
    <h2>{isWal ? 'Choose a WAL segment' : 'Choose an etcd database'}</h2>
    <p>{isWal ? <>Select a copied <code>.wal</code> file. Keep the live etcd data directory stopped while inspecting it.</> : <>Select a copied <code>member/snap/db</code> file. Stop etcd before making the copy.</>}</p>
    <label className="file-button">{file ? 'Choose another file' : isWal ? 'Browse WAL file' : 'Browse database file'}
      <input key={mode} type="file" accept={isWal ? '.wal,application/octet-stream' : '.db,application/octet-stream'} onChange={onChoose} />
    </label>
    {file && <div className="file-name">{file.name}<span>{formatBytes(file.size)}</span></div>}
  </div>
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}
