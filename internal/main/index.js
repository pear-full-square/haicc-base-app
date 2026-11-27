// main(argv, { env, bare, io }): the haicc command line (README.md beside it).
import { existsSync } from 'bare-fs'
import { join } from 'bare-path'
import os from 'bare-os'
import process from 'bare-process'
import { viewOf } from 'mrepo-base-request'
import { command } from '../command/index.js'
import { request } from '../request/index.js'
import { unpack } from '../unpack/index.js'
import { outcome } from '../outcome/index.js'
import { sourcesCommand } from '../sources/index.js'
import { outputCommand, widthOf } from '../output/index.js'
import { scriptsCommand, withFile } from '../scripts/index.js'
import { MACHINE } from '../boot/index.js'
import { CONFIG } from '../config.js'
import { Failure } from '../failure.js'
import { USAGE } from '../usage.js'

// console: the command line's own output: what the user asked for, and what went wrong
// (columns: the terminal's width now, null when the output is none)
const CONSOLE = { out: line => console.log(line), err: line => console.error(line), stdio: 'inherit', columns: () => (process.stdout.isTTY ? process.stdout.columns : null), stdin: () => readStdin() }
// stdin whole, as text: a heredoc's lines
const readStdin = () => new Promise(resolve => { if (process.stdin.isTTY) return resolve(''); let text = ''; process.stdin.on('data', d => { text += d.toString() }); process.stdin.on('end', () => resolve(text)) })

export async function main (argv, { env = {}, bare = os.execPath(), io = CONSOLE } = {}) {
  const home = env.HAICC_HOME || join(os.homedir(), '.haicc')
  const work = env.HAICC_WORK || join(home, 'work')
  const root = viewOf(work, CONFIG.root.name)
  try {
    const c = command(argv)
    if (c.kind === 'usage') { io.out(USAGE); return 0 }
    if (c.kind === 'sources') {
      for (const line of sourcesCommand(home, c.args, { org: CONFIG.org, err: io.err })) io.out(line)
      return 0
    }
    if (c.kind === 'scripts') {
      for (const line of scriptsCommand(work, c.args)) io.out(line)
      return 0
    }
    if (c.kind === 'output') {
      for (const line of outputCommand(home, c.args, io.columns?.() ?? null)) io.out(line)
      return 0
    }
    if (c.kind === 'machine') {
      const r = await MACHINE[c.protocol][c.action]({ home, work, root, bare, org: CONFIG.org, boot: CONFIG.boot, stdio: io.stdio })
      if (typeof r === 'number') return r
      // a repeat: its warning on stderr; what was done, said
      if (r?.warning) io.err(`haicc: warning: ${r.warning}`)
      io.out(r.message)
      return 0
    }
    // a command for the mrepos: into the root mrepo's inbox, what is returned printed
    if (!existsSync(join(root, 'inbox'))) throw new Failure(`no boot mrepo at ${work} (haicc boot/deploy)`, 3)
    const timeout = Number(env.HAICC_TIMEOUT) > 0 ? Number(env.HAICC_TIMEOUT) : 120
    // what is printed: the message, what is said (the default); the whole
    // request, unpacked for reading (--request); the record as it is
    // stored (--raw)
    const print = c.print ?? (env.HAICC_RAW === '1' ? 'raw' : env.HAICC_REQUEST === '1' ? 'request' : 'message')
    // one command sent, what is returned printed; -> its outcome
    const send = async parts => {
      const { text } = await request(root, parts, { uri: CONFIG.root.uri, reply: CONFIG.reply, timeout })
      const o = outcome(text)
      if (print === 'raw') io.out(text.replace(/\n$/, ''))
      if (print === 'request') io.out(unpack(text, widthOf(home, io.columns?.() ?? null).width))
      if (!o) throw new Failure('the response holds no request returned', 5)
      // failed: what is said, on stderr; exit 1, so a continuation stops here
      if (o.status === 'failed') throw new Failure(o.message, 1)
      if (print === 'message') {
        io.out(o.message)
        // its data, where data is its product: what is attached, a line
        // each; a value (content of one of AVRO's own types) below its
        // line, readable: a text as it is, anything else as JSON; content
        // of a type not held here: its size; a pointer: where its value is
        for (const a of o.attachments) {
          const carried = Object.keys(a).includes('value')
          const size = !carried && a.content != null ? Buffer.from(a.content, 'base64').length : null
          io.out(`Attached: ${a.name} (${a.type})${size !== null ? `, ${size} ${size === 1 ? 'byte' : 'bytes'}` : ''}${a.at ? `, at ${a.at}` : ''}`)
          if (carried) io.out(typeof a.value === 'string' ? a.value.replace(/\n$/, '') : JSON.stringify(a.value))
        }
      }
      return o
    }
    // haicc/script and its URI, no lines after them: the lines from stdin (a heredoc)
    // haicc/file <URI> <name>: the install's script read here, sent as haicc/script
    const given = withFile(work, c.parts)
    const parts = given.at(-2) === 'haicc/script' && io.stdin ? [...given, await io.stdin()] : given
    const o = await send(parts)
    // A continuation: the response says what to go on with, a script, its
    // lines simple commands: sent on as one command to the root, which has
    // the haicc protocol, haicc/script with the position it was answered for
    // as its URI: each line run there, as if typed at it; its outcome
    // printed. (The mrepo it is for need not link the haicc protocol.)
    if (o.continuation) {
      const { at, script } = o.continuation
      if (print === 'message') io.out(`haicc . haicc/script ${at} ...`)
      await send(['haicc/script', at, script])
    }
    return 0
  } catch (err) {
    if (err.message) io.err(`haicc: ${err.message}`)
    return err instanceof Failure ? err.code : 1
  }
}
