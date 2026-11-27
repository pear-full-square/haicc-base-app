// outcome(text): what a record's request returned: its status, what is
// said, its attachments, its continuation (README.md beside it).
// Its attachments as a reader is handed them, through the request module
// as an action is (opened): the command is no mrepo, the types it holds
// are AVRO's own (avro/<name>), so content of one of those is its value;
// content of any other type stays the wrapper, as it is.
import { opened } from 'mrepo-base-request'
import { primitiveOf } from 'mycelium-avro'

const OWN = { type: uri => { const t = primitiveOf(uri); if (!t) throw new Error(`type not held: ${uri}`); return t } }

// A continuation as a request holds one: { at, script }, the position it
// is run for and its script, shell text; anything else is none.
const continuationOf = c => (c && typeof c === 'object' && typeof c.at === 'string' && c.at && typeof c.script === 'string' && c.script.trim() ? { at: c.at, script: c.script } : null)

export function outcome (text) {
  let request = null
  // catch: not a record: no outcome to tell (the caller says so)
  try { request = JSON.parse(text)?.value } catch { return null }
  const r = request?.returned
  if (!r || typeof r !== 'object' || !['done', 'failed'].includes(r.status) || typeof r.message !== 'string') return null
  // (returned done, a continuation: a script to go on with: { at, script })
  const continuation = r.status === 'done' ? continuationOf(request.processing?.continuation) : null
  return { status: r.status, message: r.message, attachments: opened(OWN, Array.isArray(r.attachments) ? r.attachments : []), ...(continuation ? { continuation } : {}) }
}
