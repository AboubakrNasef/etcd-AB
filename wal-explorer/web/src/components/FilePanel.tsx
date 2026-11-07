import type { ChangeEvent } from 'react'
import { useAppStore } from '../store'

export function FilePanel() {
  const mode = useAppStore((state) => state.mode)
  const files = useAppStore((state) => state.files)
  const chooseFiles = useAppStore((state) => state.chooseFiles)
  const chooseFolder = useAppStore((state) => state.chooseFolder)
  const renameInstance = useAppStore((state) => state.renameInstance)
  const removeInstance = useAppStore((state) => state.removeInstance)
  const renameFile = useAppStore((state) => state.renameFile)
  const removeFile = useAppStore((state) => state.removeFile)
  const loading = useAppStore((state) => state.loading)
  function onChoose(event: ChangeEvent<HTMLInputElement>) {
    chooseFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }
  function onChooseFolder(event: ChangeEvent<HTMLInputElement>) {
    const matchingFiles = Array.from(event.target.files ?? []).filter((file) =>
      isWal ? file.name.toLowerCase().endsWith('.wal') : file.name === 'db' || file.name.toLowerCase().endsWith('.db'),
    )
    if (matchingFiles.length) {
      const folderName = matchingFiles[0].webkitRelativePath.split('/')[0] || 'Instance'
      chooseFolder(matchingFiles, folderName)
    } else if (event.target.files?.length) {
      useAppStore.setState({ error: `No ${isWal ? '.wal' : 'db or .db'} files found in the selected folder.` })
    }
    event.target.value = ''
  }
  const isWal = mode === 'wal'
  const instances = [...new Map(files.filter(item => item.instanceId).map(item => [item.instanceId!, item])).values()]
  return <div className="dropzone">
    <div className="file-mark">{isWal ? 'WAL' : 'DB'}</div>
    <h2>{isWal ? 'Choose WAL segments' : 'Choose etcd databases'}</h2>
    <p>{isWal ? <>Select copied <code>.wal</code> files to compare. Keep the live etcd data directory stopped while inspecting them.</> : <>Select copied <code>member/snap/db</code> files to compare. Stop etcd before making the copies.</>}</p>
    <div className="file-actions">
      <label className="file-button">{files.length ? 'Add another file' : 'Choose file'}
        <input key={mode} type="file" aria-label="Choose one file" disabled={loading} accept={isWal ? '.wal,application/octet-stream' : '.db,application/octet-stream'} onChange={onChoose} />
      </label>
      <label className="file-button">Add instance folder
        <input key={`${mode}-folder`} ref={(input) => { input?.setAttribute('webkitdirectory', '') }} type="file" aria-label="Add instance folder" disabled={loading} multiple onChange={onChooseFolder} />
      </label>
    </div>
    <p>Add a folder for each instance. All {isWal ? '.wal' : 'db and .db'} files in that folder and its subfolders are combined as one instance for comparison.</p>
    {instances.map(instance => {
      const members = files.filter(item => item.instanceId === instance.instanceId)
      return <div className="selected-file instance-card" key={instance.instanceId}>
        <label htmlFor={`instance-${instance.instanceId}`}>Instance name
          <input id={`instance-${instance.instanceId}`} value={instance.instanceName ?? ''} placeholder="Instance name" disabled={loading} onChange={event => renameInstance(instance.instanceId!, event.target.value)} />
        </label>
        <details><summary>{members.length} files · {formatBytes(members.reduce((total, item) => total + item.file.size, 0))}</summary>
          {members.map(item => <div className="file-name" key={item.id}><span>{item.file.webkitRelativePath || item.file.name}</span><button type="button" disabled={loading} onClick={() => removeFile(item.id)} aria-label={`Remove ${item.file.webkitRelativePath || item.file.name}`}>Remove</button></div>)}
        </details>
        <button className="remove-file" type="button" disabled={loading} onClick={() => removeInstance(instance.instanceId!)}>Remove instance</button>
      </div>
    })}
    {files.filter(item => !item.instanceId).map(({ id, file, name }) => <div className="selected-file" key={id}>
      <label htmlFor={`file-name-${id}`}>Display name
        <input id={`file-name-${id}`} value={name} placeholder={file.name} disabled={loading} onChange={(event) => renameFile(id, event.target.value)} />
      </label>
      <div className="file-name">{file.name}<span>{formatBytes(file.size)}</span></div>
      <button className="remove-file" type="button" disabled={loading} aria-label={`Remove ${name.trim() || file.name}`} onClick={() => removeFile(id)}>Remove</button>
    </div>)}
  </div>
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}
