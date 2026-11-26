// A response record printed: unpacked across lines, nothing of it changed;
// its completed form's output or error found.
import test from 'brittle'
import { unpack, outcome } from '../index.js'

const form = { command: ['haicc', 'host', 'service/start'], protocol: 'haicc', action: 'goto', uri: ['main', 'host'], args: ['service/start'], remote: { at: 'host', folder: 'main/host', key: '0c1d4c6e-6a52-4e0a-9b4a-0d7c2f0e2f11' }, output: { service: 'started', state: 'started' } }
const core = { topic: '/haicc/terminal', key: 'f949ad01-34db-4dd9-a5bc-bf438a21028c', timestamp: '2026-11-13T02:02:29.000Z', headers: {}, value: form }
const stored = v => JSON.stringify({ topic: '/outbox', key: core.key, timestamp: '2026-11-13T02:02:31.745Z', headers: {}, value: v }) + '\n'
// packed again: what unpacking added taken off: every space and line break
// outside a string (a record as stored has none there)
const packed = text => {
  let out = ''
  let instr = false
  let esc = false
  for (const c of text) {
    if (instr) { out += c; if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') instr = false; continue }
    if (c === '"') instr = true
    if (c !== ' ' && c !== '\n') out += c
  }
  return out
}

test('unpack: what fits stays as stored, what does not is opened, its entries packed on lines', (t) => {
  const text = stored(core)
  t.is(unpack(text), `{
  "topic": "/outbox", "key": "f949ad01-34db-4dd9-a5bc-bf438a21028c",
  "timestamp": "2026-11-13T02:02:31.745Z", "headers": {},
  "value": {
    "topic": "/haicc/terminal", "key": "f949ad01-34db-4dd9-a5bc-bf438a21028c",
    "timestamp": "2026-11-13T02:02:29.000Z", "headers": {},
    "value": {
      "command": ["haicc","host","service/start"], "protocol": "haicc",
      "action": "goto", "uri": ["main","host"], "args": ["service/start"],
      "remote": {
        "at": "host", "folder": "main/host",
        "key": "0c1d4c6e-6a52-4e0a-9b4a-0d7c2f0e2f11"
      },
      "output": {"service":"started","state":"started"}
    }
  }
}`, 'the record at 80 columns: an opened container\'s entries fill a line up to the width; one that does not fit a line of its own is opened below, on lines of its own')
  t.ok(unpack(text, 50).includes(`      "protocol": "haicc", "action": "goto",
      "uri": ["main","host"],
      "args": ["service/start"],
`), 'narrower: fewer on a line, an entry never split')
  t.ok(unpack(text, 60).split('\n').every(l => l.length <= 60), 'no line beyond the width where its entries fit one')
  t.is(unpack(text, 1000), text.trim(), 'a record that fits the width: left on one line')
  t.is(unpack('{}\n'), '{}', 'an empty object')
  t.is(unpack(''), '', 'nothing: nothing')
})

test('unpack: nothing of a record changed, at any width', (t) => {
  const tricky = { ...form, output: { text: 'a "quoted" word, a brace } and a bracket ] in a string, a backslash \\ and a colon ": inside', list: [1, 2.5, true, null, [], {}, [[['deep']]]], long: Array.from({ length: 40 }, (_, i) => `item-${i}`), empty: '' } }
  for (const v of [core, { ...core, value: tricky }, { ...core, value: { ...form, output: undefined, error: 'no section "x" at /packages' } }, ['a', 'list']]) {
    for (const width of [1, 20, 40, 80, 200]) {
      const text = stored(v)
      if (packed(unpack(text, width)) !== text.trim()) t.fail(`changed at width ${width}: ${text}`)
    }
  }
  t.pass('unpacked and packed again: every record as stored')
})

test('outcome: what a record\'s request returned: its status, what is said, its attachments; its continuation; not returned: none', (t) => {
  const request = { command: 'service/start', from: 'terminal', to: 'local/host', reply: '/haicc/terminal', origin: null, form: null, processing: { log: [], metrics: null, changed: [], waiting: null, sent: null, continuation: null }, returned: null }
  const rec = r => JSON.stringify({ topic: '/outbox', key: null, offset: 1795312345678, timestamp: '2026-11-13T02:02:31.745Z', headers: {}, value: r }) + '\n'
  const done = { status: 'done', message: 'The service is started: its state is started.', attachments: [] }
  t.alike(outcome(rec({ ...request, returned: done })), done, 'returned done: what is said')
  t.alike(outcome(rec({ ...request, returned: { status: 'failed', message: 'Refused, nothing run.\nnot now', attachments: [] } })), { status: 'failed', message: 'Refused, nothing run.\nnot now', attachments: [] }, 'failed: what is said, its lines as they are')
  const go = { at: 'host', script: 'service/start\n' }
  t.alike(outcome(rec({ ...request, processing: { ...request.processing, continuation: go }, returned: done })).continuation, go, 'done, with a continuation: what to go on with')
  t.absent('continuation' in outcome(rec({ ...request, processing: { ...request.processing, continuation: go }, returned: { ...done, status: 'failed' } })), 'failed: none to go on with')
  t.absent('continuation' in outcome(rec({ ...request, processing: { ...request.processing, continuation: { at: 'host', commands: [] } }, returned: done })), 'what is no continuation: none')
  t.is(outcome(rec(request)), null, 'not returned: none')
  t.is(outcome(rec({ ...request, returned: { status: 'odd', message: 'x' } })), null, 'a status there is none of: none')
  t.is(outcome('not json'), null, 'not a record: none')
})
