// outcome(text): what a record's request returned: its status, what is
// said, its attachments, its continuation (README.md beside it).
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
  return { status: r.status, message: r.message, attachments: Array.isArray(r.attachments) ? r.attachments : [], ...(continuation ? { continuation } : {}) }
}
