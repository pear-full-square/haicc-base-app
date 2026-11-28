// The command line whole, on a home folder made here: what it prints, what
// it says on stderr, its exit code. A boot mrepo's folder stands in for the
// root: its inbox answered here. No runtime is started.
import test from 'brittle'
import { inboxOf, outboxOf } from 'mrepo-base-request'
import { mkdtempSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'bare-fs'
import { tmpdir } from 'bare-os'
import { join } from 'bare-path'
import { main, LIST, USAGE, CONFIG, WIDTH } from '../index.js'

function setup () {
  const home = mkdtempSync(join(tmpdir(), 'haicc-app-'))
  const out = []; const err = []
  const run = (argv, env = {}) => { out.length = 0; err.length = 0; return main(argv, { env: { HAICC_HOME: home, ...env }, bare: '/no/bare', io: { out: l => out.push(l), err: l => err.push(l), stdio: 'ignore' } }) }
  return { home, work: join(home, 'work'), root: join(home, 'work', 'mrepos', 'boot'), out, err, run, remove: () => rmSync(home, { recursive: true, force: true }) }
}
// A request returned, as its runtime would return it: what is said of it
// ({ status, message, attachments, continuation }; null: not returned).
const returnedOf = (request, said) => (said === null ? request : { ...request, processing: { ...request.processing, continuation: said.continuation ?? null }, returned: { status: said.status ?? 'done', message: said.message, attachments: said.attachments ?? [] } })
// The next record in the root's inbox answered, as its runtime would.
function answer (root, said) {
  // (what arrives after the last one there: a pointer)
  const last = inboxOf(root).list({ limit: 1 })[0] ?? null
  return new Promise(resolve => {
    const t = setInterval(() => {
      const [offset] = inboxOf(root).list({ after: last, ascending: true, limit: 1 })
      if (offset === undefined) return
      clearInterval(t)
      const arrived = inboxOf(root).read(offset)
      outboxOf(root).put(offset, { topic: '/outbox', key: null, offset, timestamp: '2026-11-14T00:00:00.000Z', headers: {}, value: returnedOf(arrived.value, said) })
      const text = readFileSync(outboxOf(root).fileOf(offset), 'utf8')
      resolve({ arrived, text })
    }, 20)
  })
}

// Every record arriving in the root's inbox answered in turn, each with
// the next of what is given; -> the command lines as they arrived.
function answerAll (root, results) {
  let last = inboxOf(root).list({ limit: 1 })[0] ?? null
  const commands = []
  let done
  const all = new Promise(resolve => { done = resolve })
  const t = setInterval(() => {
    for (const offset of inboxOf(root).list({ after: last, ascending: true })) {
      last = offset
      const arrived = inboxOf(root).read(offset)
      const said = results[commands.length]
      commands.push(arrived.value.command)
      outboxOf(root).put(offset, { topic: '/outbox', key: null, offset, timestamp: '2026-11-14T00:00:00.000Z', headers: {}, value: returnedOf(arrived.value, said) })
      if (commands.length === results.length) { clearInterval(t); done(commands) }
    }
  }, 10)
  return { all, commands, stop: () => clearInterval(t) }
}

test('a continuation: what is returned says what to go on with, a script: sent on as haicc/script where it was answered for; what it says printed', async (t) => {
  const s = setup()
  try {
    mkdirSync(join(s.root, 'inbox'), { recursive: true }); mkdirSync(join(s.root, 'outbox'), { recursive: true })
    const script = 'service/initialise\nservice/start\n'
    let a = answerAll(s.root, [{ message: 'Deployed host as local/host.', continuation: { at: 'host', script } }, { message: 'Ran 2 lines at host.' }])
    t.is(await s.run(['.', 'boot/deploy', 'host', 'haiccing/base-component-haicc']), 0, 'exit 0: the script done')
    t.alike(await a.all, ['boot/deploy host haiccing/base-component-haicc', 'haicc/script host "service/initialise\nservice/start\n"'], 'the command, then its script, one command to the root: haicc/script, its URI the position it was answered for, its lines one word')
    t.alike(s.out, ['Deployed host as local/host.', 'haicc . haicc/script host ...', 'Ran 2 lines at host.'], 'what each says; between them, what is sent on')

    a = answerAll(s.root, [{ message: 'Done.', continuation: { at: '.', script: 'x/y\n' } }, { status: 'failed', message: 'line 1: x/y: Refused, nothing run.' }])
    t.is(await s.run(['.', 'a/b']), 1, 'the script fails: exit 1')
    await a.all
    t.alike([a.commands[1], s.err], ['haicc/script . "x/y\n"', ['haicc: line 1: x/y: Refused, nothing run.']], 'at the root: sent plain; where it stopped, said')
    a.stop()

    a = answerAll(s.root, [{ message: 'Done.', continuation: { at: 'host', commands: [['a/b']] } }])
    t.is(await s.run(['.', 'x/y']), 0)
    await a.all
    await new Promise(resolve => setTimeout(resolve, 100))
    t.is(a.commands.length, 1, 'what is no continuation is none: a list of commands, the form of before')
    a = answerAll(s.root, [{ status: 'failed', message: 'Failed.', continuation: { at: 'host', script } }])
    t.is(await s.run(['.', 'x/y']), 1)
    await a.all
    await new Promise(resolve => setTimeout(resolve, 100))
    t.is(a.commands.length, 1, 'failed: nothing to go on with')
  } finally { s.remove() }
})

test('the usage; not a command: exit 2, said on stderr', async (t) => {
  const s = setup()
  try {
    t.is(await s.run(['--help']), 0)
    t.alike(s.out, [USAGE], 'haicc --help: the usage')
    t.is(await s.run(['nosuch']), 2)
    t.alike([s.out, s.err], [[], ["haicc: no command 'nosuch' (haicc --help; a URI is followed by its command: haicc nosuch info/get)"]], 'haicc: <what>, on stderr; nothing printed')
    t.is(await s.run(['boot']), 2)
    t.alike(s.err, ['haicc: haicc boot/deploy, haicc boot/teardown'])
  } finally { s.remove() }
})

test('nothing booted: an mrepo command says so, exit 3; the teardown a repeat, a warning, exit 0; a deploy without the boot component in the sources', async (t) => {
  const s = setup()
  try {
    t.is(await s.run(['host', 'service/start']), 3)
    t.alike(s.err, [`haicc: no boot mrepo at ${join(s.home, 'work')} (haicc boot/deploy)`])
    t.is(await s.run(['boot/teardown']), 0, 'the teardown: idempotent, exit 0')
    t.alike(s.err, [`haicc: warning: no boot mrepo at ${join(s.home, 'work')}: nothing to tear down`], 'a warning on stderr')
    t.is(await s.run(['.', 'help/get'], { HAICC_WORK: join(s.home, 'elsewhere') }), 3)
    t.alike(s.err, [`haicc: no boot mrepo at ${join(s.home, 'elsewhere')} (haicc boot/deploy)`], 'HAICC_WORK: another work folder')
    mkdirSync(join(s.home, 'src'))
    writeFileSync(join(s.home, LIST), `folder:${join(s.home, 'src')}\n`)
    t.is(await s.run(['boot/deploy']), 3)
    t.alike(s.err, [`haicc: no ${CONFIG.org}/${CONFIG.boot}.bundle in the sources (haicc sources link <folder>)`])
    t.absent(existsSync(join(s.home, 'work')), 'nothing written')
  } finally { s.remove() }
})

test('haicc sources: printed a line a source', async (t) => {
  const s = setup()
  try {
    writeFileSync(join(s.home, LIST), 'folder:/a\ngithub:haiccing\n')
    t.is(await s.run(['sources']), 0)
    t.alike(s.out, ['folder:/a', 'github:haiccing'])
    t.is(await s.run(['sources', 'download', 'haiccing/base-package-runtime']), 3)
    t.alike(s.err, ['haicc: haiccing/base-package-runtime: a package is not downloaded alone; its organisation is (haicc sources download haiccing)'], 'said once, exit 3')
  } finally { s.remove() }
})

test('a command for the mrepos: what it says printed, with what is attached; the whole request, or its record as stored, by a flag; failed, exit 1; not returned, exit 5; none in time, exit 4', async (t) => {
  const s = setup()
  try {
    mkdirSync(join(s.root, 'inbox'), { recursive: true }); mkdirSync(join(s.root, 'outbox'))
    const said = { message: 'Deployed host as local/host, from haiccing/base-component-haicc.\n12 packages placed.\nIts runtime is running, pid 4242.' }
    let a = answer(s.root, said)
    t.is(await s.run(['.', 'boot/deploy', 'host', 'haiccing/base-component-haicc']), 0, 'returned done: exit 0')
    let { arrived, text } = await a
    t.is(arrived.topic, `/${CONFIG.root.uri}/inbox`, 'sent to the root mrepo\'s inbox: a record')
    t.alike([arrived.value.command, arrived.value.from, arrived.value.to, arrived.value.reply, arrived.value.form, arrived.value.returned], ['boot/deploy host haiccing/base-component-haicc', 'terminal', CONFIG.root.uri, CONFIG.reply, null, null], 'around a request: at the root the command plain, its line as typed; who asks, the mrepo it is for, where its answer goes')
    t.alike(s.out, [said.message], 'by default what it says, as it is: nothing else')

    a = answer(s.root, { message: 'Read notes.', attachments: [{ name: 'the document', type: 'string', at: 'main/notes/.node.json' }, { name: 'its rows', type: 'haiccing/base-package-crud/nodes', content: 'AAEC', at: null }, { name: 'its text', type: 'avro/string', content: 'CmhlbGxv', at: null }, { name: 'its count', type: 'avro/long', content: 'Bg==', at: null }, { name: 'its bytes', type: 'avro/bytes', content: 'BAEC', at: null }] })
    t.is(await s.run(['host', 'crud/read', 'notes']), 0)
    ;({ arrived } = await a)
    t.is(arrived.value.command, 'haicc host crud/read notes', 'elsewhere: the haicc command as it is')
    t.alike(s.out, ['Read notes.', 'Attached: the document (string), at main/notes/.node.json', 'Attached: its rows (haiccing/base-package-crud/nodes), 3 bytes', 'Attached: its text (avro/string)', 'hello', 'Attached: its count (avro/long)', '3', 'Attached: its bytes (avro/bytes)', 'AQI='], 'what is attached: a line each, its name, its type; a pointer, where it is; content of a type not held here, its size; content of one of AVRO\'s own types below its line, readable')

    a = answer(s.root, said)
    t.is(await s.run(['--raw', 'host', 'service/start']), 0)
    ;({ text } = await a)
    t.alike(s.out, [text.trim()], '--raw: the record as stored, one line')
    a = answer(s.root, said)
    t.is(await s.run(['.', 'help/get'], { HAICC_RAW: '1' }), 0); await a
    t.is(s.out[0].split('\n').length, 1, 'HAICC_RAW=1: the same')

    // (what is said kept short: a text is never broken across lines)
    const brief = { message: 'Deployed host.' }
    a = answer(s.root, brief)
    t.is(await s.run(['--request', '.', 'help/get']), 0); ({ text } = await a)
    t.is(s.out.length, 1)
    t.ok(s.out[0].split('\n').length > 3 && s.out[0].split('\n').every(l => l.length <= 80), '--request: the whole request, its record unpacked across lines, to 80 columns: the output is no terminal, no width set')
    t.is(JSON.stringify(JSON.parse(s.out[0])), text.trim(), 'packed again: the record as stored')
    a = answer(s.root, brief)
    t.is(await s.run(['.', 'help/get'], { HAICC_REQUEST: '1' }), 0); await a
    t.ok(s.out[0].split('\n').length > 3, 'HAICC_REQUEST=1: the same')

    t.is(await s.run(['output', '1000']), 0)
    t.alike(s.out, ['1000 (set: haicc output auto for the terminal\'s width)'], 'haicc output <width>: set, kept in haicc\'s own folder')
    t.is(readFileSync(join(s.home, WIDTH), 'utf8'), '1000\n')
    a = answer(s.root, brief)
    t.is(await s.run(['--request', '.', 'help/get']), 0); await a
    t.is(s.out[0].split('\n').length, 1, 'a record that fits the width set: left on one line')
    t.is(await s.run(['output']), 0)
    t.alike(s.out, ['1000 (set: haicc output auto for the terminal\'s width)'], 'haicc output: the width in force, where it comes from')
    t.is(await s.run(['output', 'auto']), 0)
    t.alike([s.out, existsSync(join(s.home, WIDTH))], [['auto: 80 (the output is no terminal)'], false], 'haicc output auto: back to the default')
    t.is(await s.run(['output', 'wide']), 2)
    t.alike(s.err, ['haicc: haicc output [<width> | auto] (a width: a number of characters, or auto)'])
    t.is(await s.run(['output', '80', '90']), 2)
    a = answer(s.root, brief)
    t.is(await main(['--request', '.', 'help/get'], { env: { HAICC_HOME: s.home }, bare: '/no/bare', io: { out: l => s.out.splice(0, s.out.length, l), err: () => {}, stdio: 'ignore', columns: () => 132 } }), 0); await a
    t.ok(s.out[0].split('\n').some(l => l.length > 80) && s.out[0].split('\n').every(l => l.length <= 132), 'auto: the terminal\'s width, read as the request is printed')

    a = answer(s.root, { status: 'failed', message: 'Refused, nothing run.\nnot now: boot deploy (boot is not active)' })
    t.is(await s.run(['.', 'boot/deploy', 'host', 'x']), 1, 'returned failed: exit 1')
    await a
    t.alike([s.out, s.err], [[], ['haicc: Refused, nothing run.\nnot now: boot deploy (boot is not active)']], 'what is said, on stderr; nothing on stdout')
    a = answer(s.root, { status: 'failed', message: 'Not run: its flags.\nno flag: nope' })
    t.is(await s.run(['--request', '.', 'crud/read', 'x', '--flags', 'nope']), 1, 'its flags kept it from being run: failed, exit 1'); ({ arrived } = await a)
    t.alike([arrived.value.command, s.out.length, s.err], ['crud/read x --flags nope', 1, ['haicc: Not run: its flags.\nno flag: nope']], '--request: the request printed all the same; why, on stderr')

    a = answer(s.root, null)
    t.is(await s.run(['.', 'help/get']), 5, 'a response whose request is not returned: exit 5'); await a
    t.alike(s.err, ['haicc: the response holds no request returned'])

    t.is(await s.run(['.', 'help/get'], { HAICC_TIMEOUT: '0.3' }), 4, 'HAICC_TIMEOUT: no response in time, exit 4')
    t.ok(/^haicc: no response in 0\.3 s \(the request stays: \d{13}\)$/.test(s.err[0]), s.err[0])
  } finally { s.remove() }
})

test('boot/teardown: what boot/deploy put in place removed, the packages\' scripts too, nothing else; no runtime running: none stopped; twice: a repeat', async (t) => {
  const s = setup()
  try {
    const work = join(s.home, 'work')
    for (const d of ['mrepos/boot/.git', 'mrepos/boot/inbox', 'mrepos/local/host/.git', 'mrepos/swarm-1/peer-1/.git', 'packages/haiccing', 'kept']) mkdirSync(join(work, d), { recursive: true })
    writeFileSync(join(work, 'mrepo.json'), '{}')
    mkdirSync(join(work, 'scripts', 'haiccing', 'base-component-haicc'), { recursive: true })
    writeFileSync(join(work, 'scripts', 'haiccing', 'base-component-haicc', 'cluster.haicc'), 'crud/read .\n')
    writeFileSync(join(work, 'scripts', 'mine.haicc'), 'crud/read .\n')
    t.is(await s.run(['boot/teardown']), 0)
    t.alike(s.out, [`Torn down the install at ${work}: 0 runtimes stopped, 0 containers removed; its mrepos, its package store and its packages' scripts removed, yours kept.`], 'said: the install torn down, the runtimes stopped, the containers removed, where')
    t.alike(readdirSync(work).sort(), ['kept', 'scripts'], 'the mrepos, the package store and the setting removed; the rest of the work folder kept')
    t.alike(readdirSync(join(work, 'scripts')), ['mine.haicc'], 'the packages\' scripts removed, the user\'s kept')
    t.is(await s.run(['boot/teardown']), 0, 'twice: a repeat, exit 0')
    t.alike(s.out, [`Nothing to tear down at ${work}: no boot mrepo there.`], 'said: nothing there')
  } finally { s.remove() }
})

test('the install\'s scripts: haicc scripts lists them; haicc/file <URI> <name> reads one here and sends it as haicc/script', async (t) => {
  const s = setup()
  try {
    t.is(await s.run(['scripts']), 0, 'none yet: exit 0')
    t.alike(s.out, [], 'nothing listed')
    // in the work folder's scripts/: a package's placed by a deploy, the user's beside them
    mkdirSync(join(s.work, 'scripts', 'haiccing', 'base-component-haicc'), { recursive: true })
    writeFileSync(join(s.work, 'scripts', 'check.haicc'), 'crud/read .\n')
    writeFileSync(join(s.work, 'scripts', 'haiccing', 'base-component-haicc', 'peer.haicc'), 'service/initialise\nservice/start\n')
    t.is(await s.run(['scripts']), 0)
    t.alike(s.out, ['check', 'haiccing/base-component-haicc/peer'], 'the user\'s, then each package\'s, by name')
    mkdirSync(join(s.root, 'inbox'), { recursive: true }); mkdirSync(join(s.root, 'outbox'), { recursive: true })
    let a = answerAll(s.root, [{ message: 'Ran 1 line at ..' }])
    t.is(await s.run(['host', 'haicc/file', '.', 'check']), 0, 'exit 0')
    t.alike(await a.all, ['haicc host haicc/script . "crud/read .\n"'], 'sent as haicc/script, its lines read here: no mrepo reads a file of the machine')
    a = answerAll(s.root, [{ message: 'Ran 2 lines at swarms/swarm-1.' }])
    t.is(await s.run(['.', 'haicc/file', 'swarms/swarm-1', 'haiccing/base-component-haicc/peer']), 0)
    t.alike(await a.all, ['haicc/script swarms/swarm-1 "service/initialise\nservice/start\n"'], 'a package\'s, by its org and package; its URI where the lines run')
    a.stop()
    t.is(await s.run(['host', 'haicc/file', '.', 'nope']), 3, 'no such script: exit 3')
    t.ok(/^haicc: no script: nope \(/.test(s.err[0]), 'said, with where it was looked for')
    t.is(await s.run(['host', 'haicc/file', '.', '../etc/passwd']), 2, 'a path: no name, exit 2')
    t.is(await s.run(['host', 'haicc/file', '.']), 2, 'no name: exit 2')
  } finally { s.remove() }
})
