// sources(home): the sources registered, and the haicc sources command
// (README.md beside it).
import { existsSync, readFileSync, writeFileSync, renameSync, statSync } from 'bare-fs'
import { join, resolve } from 'bare-path'
import { Failure } from '../failure.js'

// The lists, in haicc's own folder, a line a source. Internal, the
// install's sources, what the platform reads: folder:<path>, in the order
// linked. External, github:<org>: a record of where each download came
// from; never handed inside the platform, nothing reads it to act on it yet.
export const LIST = 'sources.list'
export const EXTERNAL = 'external.list'
const FOLDER = 'folder:'
// catch: not there: not a folder
const isFolder = f => { try { return statSync(f).isDirectory() } catch { return false } }

export function sources (home) {
  const at = name => join(home, name)
  const lines = name => existsSync(at(name)) ? readFileSync(at(name), 'utf8').split('\n').filter(Boolean) : []
  const write = (name, l) => { writeFileSync(`${at(name)}.part`, l.map(x => `${x}\n`).join('')); renameSync(`${at(name)}.part`, at(name)) }
  // a line's list: a folder the internal one, any other kind the external
  const listOf = entry => entry.startsWith(FOLDER) ? LIST : EXTERNAL
  const self = {
    // the internal list's folders, in the order linked
    folders: () => lines(LIST).filter(l => l.startsWith(FOLDER)).map(l => l.slice(FOLDER.length)),
    external: () => lines(EXTERNAL),
    // a line in the internal list that is no folder (one an install made
    // before the split kept there): not read
    unread: () => lines(LIST).filter(l => !l.startsWith(FOLDER)),
    // a file (relative to a source) in the first folder that holds it
    find: name => self.folders().map(d => join(d, name)).find(f => existsSync(f)) ?? null,
    register: entry => { const n = listOf(entry); if (!lines(n).includes(entry)) write(n, [...lines(n), entry]) },
    // taken off whichever list holds it
    unregister: entry => { for (const n of [LIST, EXTERNAL]) if (lines(n).includes(entry)) write(n, lines(n).filter(l => l !== entry)) },
    // what haicc sources prints: the internal, then the external, then
    // what is not read, said
    shown: () => [...self.folders().map(f => `${FOLDER}${f}`), ...self.external(), ...self.unread().map(l => `${l} (in ${LIST}, not read: the install reads folders only)`)]
  }
  return self
}

const USAGE = 'haicc sources [unlink <folder>|<source> | download <org>...]'
// An organisation's name: <org>
const ORG = /^[a-z][a-z0-9-]*$/

// haicc sources <action> <argument>...: what it prints, a line each.
export function sourcesCommand (home, args, { err = () => {} } = {}) {
  const s = sources(home)
  const [action = 'list', ...rest] = args
  switch (action) {
    case 'list':
      if (rest.length) throw new Failure(USAGE, 2)
      return s.shown()
    case 'unlink': {
      if (rest.length !== 1) throw new Failure('haicc sources unlink <folder>|<source>', 2)
      // a source as listed (<kind>:...), else a folder, as written when it is gone
      const [x] = rest
      s.unregister(/^[a-z]+:/.test(x) ? x : `${FOLDER}${isFolder(x) ? resolve(x) : x}`)
      return s.shown()
    }
    case 'download': {
      // what the first step (sh, before Bare) fetches never comes here:
      // bare, third-party and the organisations; a package alone is never
      // downloaded
      if (!rest.length) throw new Failure('haicc sources download bare|<org>...', 2)
      for (const what of rest) {
        if (what.includes('/')) err(`haicc: ${what}: a package is not downloaded alone; its organisation is (haicc sources download ${what.split('/')[0]})`)
        else if (what === 'bare' || what === 'third-party' || ORG.test(what)) err(`haicc: ${what}: fetched before the app (haicc sources download ${what})`)
        else err(`haicc: nothing to download for '${what}' (bare, <org>)`)
      }
      throw new Failure('', 3)
    }
    default:
      throw new Failure(USAGE, 2)
  }
}
