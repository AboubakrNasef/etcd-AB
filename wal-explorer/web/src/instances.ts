import type { DecodeResult } from './types'

export type InstanceResult = { instanceId?: string; instanceName?: string; result: DecodeResult }

export function combineInstanceResults(items: InstanceResult[]): DecodeResult[] {
  const results: DecodeResult[] = []
  const instances = new Map<string, DecodeResult>()
  for (const { instanceId, instanceName, result } of items) {
    if (!instanceId) {
      results.push(result)
      continue
    }
    let combined = instances.get(instanceId)
    if (!combined) {
      combined = { fileName: instanceName || 'Unnamed instance', records: [], errors: [] }
      instances.set(instanceId, combined)
      results.push(combined)
    }
    for (const record of result.records) combined.records.push({ ...record, number: combined.records.length + 1 })
    combined.errors!.push(...(result.errors ?? []).map(error => `${result.fileName}: ${error}`))
  }
  return results
}
