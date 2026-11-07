import { useState, type ChangeEvent, type DragEvent } from 'react'
import { useAppStore } from '../store'
import { groupInstanceFolders, matchesMode, readDroppedDirectory } from '../folders'

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
  const [readingFolders, setReadingFolders] = useState(false)
  const [dragging, setDragging] = useState(false)
  const busy = loading || readingFolders
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
  function onChooseInstances(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    const groups = groupInstanceFolders(selected, mode)
    for (const group of groups) chooseFolder(group.files, group.name)
    if (selected.length && !groups.length) useAppStore.setState({ error: 'No instance subfolders with matching files found. Select the parent folder containing your instance folders.' })
    event.target.value = ''
  }
  async function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (busy) return
    const entries = Array.from(event.dataTransfer.items).map(item => item.webkitGetAsEntry?.()).filter((entry): entry is FileSystemEntry => !!entry)
    if (!entries.length) {
      useAppStore.setState({ error: 'Folder dropping is unavailable in this browser. Use Choose instances folder instead.' })
      return
    }
    setReadingFolders(true)
    try {
      const groups = await Promise.all(entries.map(async entry => ({ entry, files: (await readDroppedDirectory(entry)).filter(file => matchesMode(file, mode)) })))
      if (useAppStore.getState().mode !== mode) return
      if (useAppStore.getState().loading) {
        useAppStore.setState({ error: 'Inspection started while reading folders. Drop the folders again after inspection finishes.' })
        return
      }
      let added = 0
      const emptyFolders: string[] = []
      for (const group of groups) {
        if (!group.files.length) { if (group.entry.isDirectory) emptyFolders.push(group.entry.name); continue }
        if (group.entry.isDirectory) chooseFolder(group.files, group.entry.name)
        else chooseFiles(group.files)
        added += group.files.length
      }
      if (emptyFolders.length || !added) useAppStore.setState({ error: emptyFolders.length ? `No matching files in: ${emptyFolders.join(', ')}` : 'No matching files found in the dropped items.' })
    } catch (reason) {
      useAppStore.setState({ error: `Unable to read dropped folders: ${reason instanceof Error ? reason.message : String(reason)}` })
    } finally { setReadingFolders(false) }
  }
  const isWal = mode === 'wal'
  const instances = [...new Map(files.filter(item => item.instanceId).map(item => [item.instanceId!, item])).values()]
  return <div className={`dropzone ${dragging ? 'dragging-folders' : ''}`} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }} onDrop={onDrop}>
    <div className="file-mark">{isWal ? 'WAL' : 'DB'}</div>
    <h2>{isWal ? 'Choose WAL segments' : 'Choose etcd databases'}</h2>
    <p>{isWal ? <>Select copied <code>.wal</code> files to compare. Keep the live etcd data directory stopped while inspecting them.</> : <>Select copied <code>member/snap/db</code> files to compare. Stop etcd before making the copies.</>}</p>
    <div className="file-actions">
      <label className="file-button">{files.length ? 'Add another file' : 'Choose file'}
        <input key={mode} type="file" aria-label="Choose one file" disabled={busy} accept={isWal ? '.wal,application/octet-stream' : '.db,application/octet-stream'} onChange={onChoose} />
      </label>
      <label className="file-button">Add instance folder
        <input key={`${mode}-folder`} ref={(input) => { input?.setAttribute('webkitdirectory', '') }} type="file" aria-label="Add instance folder" disabled={busy} multiple onChange={onChooseFolder} />
      </label>
      <label className="file-button">Choose instances folder
        <input key={`${mode}-instances`} ref={input => { input?.setAttribute('webkitdirectory', '') }} type="file" aria-label="Choose parent folder containing instances" disabled={busy} multiple onChange={onChooseInstances} />
      </label>
    </div>
    <div className="folder-drop-hint" role="status">{readingFolders ? 'Reading instance folders…' : 'Drop multiple instance folders here together'}</div>
    <p>Select several folders in your file manager and drag them here. Or use <strong>Choose instances folder</strong> to select their parent folder: each immediate subfolder becomes a separate instance. Matching {isWal ? '.wal' : 'db and .db'} files are included recursively.</p>
    {instances.map(instance => {
      const members = files.filter(item => item.instanceId === instance.instanceId)
      return <div className="selected-file instance-card" key={instance.instanceId}>
        <label htmlFor={`instance-${instance.instanceId}`}>Instance name
          <input id={`instance-${instance.instanceId}`} value={instance.instanceName ?? ''} placeholder="Instance name" disabled={busy} onChange={event => renameInstance(instance.instanceId!, event.target.value)} />
        </label>
        <details><summary>{members.length} files · {formatBytes(members.reduce((total, item) => total + item.file.size, 0))}</summary>
          {members.map(item => <div className="file-name" key={item.id}><span>{item.file.webkitRelativePath || item.file.name}</span><button type="button" disabled={busy} onClick={() => removeFile(item.id)} aria-label={`Remove ${item.file.webkitRelativePath || item.file.name}`}>Remove</button></div>)}
        </details>
        <button className="remove-file" type="button" disabled={busy} onClick={() => removeInstance(instance.instanceId!)}>Remove instance</button>
      </div>
    })}
    {files.filter(item => !item.instanceId).map(({ id, file, name }) => <div className="selected-file" key={id}>
      <label htmlFor={`file-name-${id}`}>Display name
        <input id={`file-name-${id}`} value={name} placeholder={file.name} disabled={busy} onChange={(event) => renameFile(id, event.target.value)} />
      </label>
      <div className="file-name">{file.name}<span>{formatBytes(file.size)}</span></div>
      <button className="remove-file" type="button" disabled={busy} aria-label={`Remove ${name.trim() || file.name}`} onClick={() => removeFile(id)}>Remove</button>
    </div>)}
  </div>
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}
