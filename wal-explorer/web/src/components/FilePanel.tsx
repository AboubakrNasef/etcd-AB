import type { ChangeEvent } from 'react'
import { useAppStore } from '../store'

export function FilePanel() {
  const mode = useAppStore((state) => state.mode)
  const files = useAppStore((state) => state.files)
  const chooseFiles = useAppStore((state) => state.chooseFiles)
  function onChoose(event: ChangeEvent<HTMLInputElement>) {
    chooseFiles(Array.from(event.target.files ?? []))
  }
  const isWal = mode === 'wal'
  return <div className="dropzone">
    <div className="file-mark">{isWal ? 'WAL' : 'DB'}</div>
    <h2>{isWal ? 'Choose WAL segments' : 'Choose etcd databases'}</h2>
    <p>{isWal ? <>Select copied <code>.wal</code> files to compare. Keep the live etcd data directory stopped while inspecting them.</> : <>Select copied <code>member/snap/db</code> files to compare. Stop etcd before making the copies.</>}</p>
    <label className="file-button">{files.length ? 'Choose files' : isWal ? 'Browse WAL files' : 'Browse database files'}
      <input key={mode} type="file" multiple accept={isWal ? '.wal,application/octet-stream' : '.db,application/octet-stream'} onChange={onChoose} />
    </label>
    {files.map((file) => <div className="file-name" key={`${file.name}-${file.lastModified}`}>{file.name}<span>{formatBytes(file.size)}</span></div>)}
  </div>
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}
