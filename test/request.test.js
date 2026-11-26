// A command sent: its record in the mrepo's inbox folder, value by value;
// its response waited for in the outbox folder.
import test from 'brittle'
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from 'bare-fs'
import { inboxOf, outboxOf, nameOf } from 'mrepo-base-request'
import { tmpdir } from 'bare-os'
import { join } from 'bare-path'
import { request, Failure } from '../index.js'

// An mrepo's folder, its two boxes; answer(): the first record in its inbox
// answered in its outbox, as a runtime would (its request returned).
function mrepo () {
  const root = mkdtempSync(join(tmpdir(), 'haicc-app-'))
  mkdirSync(join(root, 'inbox')); mkdirSync(join(root, 'outbox'))
  const answer = (result, after = 50) => new Promise(resolve => {
    const t = setInterval(() => {
      const arrived = inboxOf(root).list()
      if (!arrived.length) return
      clearInterval(t)
      const record = inboxOf(root).read(arrived[0])
      setTimeout(() => {
        outboxOf(root).put(arrived[0], { topic: '/outbox', key: null, offset: record.offset, timestamp: '2026-11-26T10:00:00.000Z', headers: {}, value: { ...record.value, returned: { status: 'done', message: result, attachments: [] } } })
        resolve({ arrived, record })
      }, after)
    }, 20)
  })
  return { root, answer, remove: () => rmSync(root, { recursive: true, force: true }) }
}

test('request: the record written, value by value; its answer read as stored', async (t) => {
  const m = mrepo()
  try {
    const answered = m.answer('Deployed.')
    const r = await request(m.root, ['boot/deploy', 'host', 'a "b" c'], { uri: 'local/boot', reply: '/haicc/terminal', timeout: 5, every: 20 })
    const { arrived, record } = await answered
    t.alike(arrived.map(nameOf), [r.key], 'one record in the inbox folder, named by its offset')
    t.ok(/^\d{13}$/.test(r.key) && Math.abs(Number(r.key) - Date.now()) < 60000, 'its offset: the milliseconds when it arrived, given as it was dropped')
    t.ok(existsSync(join(m.root, 'inbox', r.key.slice(0, 5), r.key.slice(0, 6), `${r.key}.json`)), 'a streaming folder: in its buckets, nothing half written beside it')
    t.alike(Object.keys(record), ['topic', 'key', 'offset', 'timestamp', 'headers', 'value'], 'a record, the transport\'s envelope, and what it carries')
    t.is(record.topic, '/local/boot/inbox', "addressed to the mrepo's inbox, by its unique URI")
    t.is(nameOf(record.offset), r.key, 'its offset the request\'s')
    t.alike([record.key, record.headers], [null, {}], 'no key, its headers empty')
    t.is(new Date(record.timestamp).toISOString(), record.timestamp, 'its timestamp a time')
    t.alike(record.value, { command: 'boot/deploy host "a \\"b\\" c"', from: 'terminal', to: 'local/boot', reply: '/haicc/terminal', origin: null, form: null, processing: { log: [], metrics: null, changed: [], waiting: null, sent: null, continuation: null }, returned: null }, 'its value the request: the command its line, its words written as one (a word with blanks and quotes kept one); who asks, the mrepo it is for, where its answer goes; nothing understood or returned yet')
    t.is(r.text, readFileSync(outboxOf(m.root).fileOf(Number(r.key)), 'utf8'), 'its answer: the record in the outbox folder under the same offset, as stored')
    t.is(JSON.parse(r.text).value.returned.message, 'Deployed.')
    await request(m.root, 'crud/read . --flags log=debug', { uri: 'local/boot', reply: '/haicc/terminal', timeout: 0.05, every: 20 }).catch(() => null)
    t.is(inboxOf(m.root).read(inboxOf(m.root).list()[0]).value.command, 'crud/read . --flags log=debug', 'a line given: as typed')
  } finally { m.remove() }
})

test('request: its response seen as it arrives: the outbox folder watched, not looked at on a clock', async (t) => {
  const m = mrepo()
  try {
    const answered = m.answer('Read.', 100)
    const began = Date.now()
    // (a look only every 5 s: without the watching this would end in no response)
    const r = await request(m.root, ['help/get'], { uri: 'local/boot', reply: '/haicc/terminal', timeout: 3, every: 5000 })
    await answered
    t.is(JSON.parse(r.text).value.returned.message, 'Read.', 'its answer read')
    t.ok(Date.now() - began < 2500, 'well before the next look: it was told')
  } finally { m.remove() }
})

test('request: no response in time: exit 4, the offset said; the request stays', async (t) => {
  const m = mrepo()
  try {
    let failure = null
    try { await request(m.root, ['help/get'], { uri: 'local/boot', reply: '/haicc/terminal', timeout: 0.2, every: 20 }) } catch (err) { failure = err }
    t.ok(failure instanceof Failure && failure.code === 4, 'exit 4')
    const [stays] = inboxOf(m.root).list()
    t.is(failure.message, `no response in 0.2 s (the request stays: ${nameOf(stays)})`, 'said, with its offset')
  } finally { m.remove() }
})
