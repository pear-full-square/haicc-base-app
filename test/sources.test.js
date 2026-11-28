// The sources registered: the list's file read and written, and the haicc
// sources command's actions.
import test from 'brittle'
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'bare-fs'
import { tmpdir } from 'bare-os'
import { join } from 'bare-path'
import { sources, sourcesCommand, LIST, EXTERNAL, Failure } from '../index.js'

const home = () => mkdtempSync(join(tmpdir(), 'haicc-app-'))

test('sources: two lists, the internal its folders in the order linked, the external apart; a line not read said; a file in the first folder that holds it', (t) => {
  const h = home()
  try {
    const s = sources(h)
    t.alike(s.shown(), [], 'no lists yet: none')
    t.is(s.find('org/x.bundle'), null)
    mkdirSync(join(h, 'a', 'org'), { recursive: true }); mkdirSync(join(h, 'b', 'org'), { recursive: true })
    writeFileSync(join(h, 'b', 'org', 'x.bundle'), 'b'); writeFileSync(join(h, 'b', 'org', 'y.bundle'), 'b'); writeFileSync(join(h, 'a', 'org', 'y.bundle'), 'a')
    // an install made before the split: a github: line in the internal list
    writeFileSync(join(h, LIST), `github:org\nfolder:${join(h, 'a')}\nfolder:${join(h, 'b')}\n`)
    t.alike(s.folders(), [join(h, 'a'), join(h, 'b')], 'the folders, in order: the github: line not read')
    t.alike(s.unread(), ['github:org'], 'not read: said')
    t.is(s.find('org/x.bundle'), join(h, 'b', 'org', 'x.bundle'), 'found in the second folder')
    t.is(s.find('org/y.bundle'), join(h, 'a', 'org', 'y.bundle'), 'in both: the first')
    t.is(s.find('org/z.bundle'), null, 'in none')
    s.register('github:org'); s.register('github:org'); s.register('folder:/c')
    t.is(readFileSync(join(h, EXTERNAL), 'utf8'), 'github:org\n', 'a github: line registered in the external list, once')
    t.alike(s.folders(), [join(h, 'a'), join(h, 'b'), '/c'], 'a folder in the internal list')
    t.alike(s.shown(), [`folder:${join(h, 'a')}`, `folder:${join(h, 'b')}`, 'folder:/c', 'github:org', `github:org (in ${LIST}, not read: the install reads folders only)`], 'shown: the folders, the external, what is not read')
    s.unregister('github:org')
    t.alike([s.external(), s.unread()], [[], []], 'unregistered: off whichever list holds it')
    s.unregister(`folder:${join(h, 'a')}`)
    t.alike(s.folders(), [join(h, 'b'), '/c'], 'a folder unregistered')
    t.absent(existsSync(join(h, `${LIST}.part`)) || existsSync(join(h, `${EXTERNAL}.part`)), 'written aside, renamed')
  } finally { rmSync(h, { recursive: true, force: true }) }
})

test('haicc sources: the lists, unlink from either, https and no-https gone, download', (t) => {
  const h = home()
  try {
    const said = []
    const run = (...args) => sourcesCommand(h, args, { err: l => said.push(l) })
    const refused = (args, code) => { try { run(...args); return null } catch (err) { return err instanceof Failure && err.code === code ? err.message : `not ${code}: ${err.message}` } }
    mkdirSync(join(h, 'src'))
    writeFileSync(join(h, LIST), `folder:${join(h, 'src')}\ngithub:haiccing\n`)
    writeFileSync(join(h, EXTERNAL), 'github:splectral\n')
    const stray = `github:haiccing (in ${LIST}, not read: the install reads folders only)`
    t.alike(run(), [`folder:${join(h, 'src')}`, 'github:splectral', stray], 'haicc sources: the internal, the external, what is not read')
    t.alike(run('list'), run(), 'haicc sources list: the same')
    t.alike(run('unlink', 'github:haiccing'), [`folder:${join(h, 'src')}`, 'github:splectral'], 'unlink: a line not read, off the internal list')
    t.alike(run('unlink', 'github:splectral'), [`folder:${join(h, 'src')}`], 'unlink: an external source')
    t.alike(run('unlink', join(h, 'src')), [], 'unlink: a folder that is there')
    writeFileSync(join(h, LIST), 'folder:/gone/away\n')
    t.alike(run('unlink', '/gone/away'), [], 'unlink: a folder that is no longer there, as it was written')
    t.is(refused(['unlink'], 2), 'haicc sources unlink <folder>|<source>', 'unlink without one: exit 2')
    const usage = 'haicc sources [unlink <folder>|<source> | download <org>...]'
    t.is(refused(['link', '/x'], 2), usage, 'link is not the app\'s: exit 2, its own actions said')
    t.is(refused(['https'], 2), usage, 'https: gone, exit 2')
    t.is(refused(['no-https'], 2), usage, 'no-https: gone, exit 2')
    t.is(refused(['download', 'haiccing'], 3), '', 'download haiccing, here: exit 3')
    t.is(said.pop(), 'haicc: haiccing: fetched before the app (haicc sources download haiccing)', 'said: the first step\'s')
    t.is(refused(['download'], 2), 'haicc sources download bare|<org>...', 'download, nothing named: exit 2')
    t.is(refused(['download', 'haiccing/base-package-runtime', 'No such', 'bare'], 3), '', 'several: each said, exit 3')
    t.alike(said.splice(0), ['haicc: haiccing/base-package-runtime: a package is not downloaded alone; its organisation is (haicc sources download haiccing)', "haicc: nothing to download for 'No such' (bare, <org>)", 'haicc: bare: fetched before the app (haicc sources download bare)'])
  } finally { rmSync(h, { recursive: true, force: true }) }
})
