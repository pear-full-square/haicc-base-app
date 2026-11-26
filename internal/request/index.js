// request(root, command, { uri, reply, from, timeout }): a command sent to
// an mrepo, its request returned waited for (README.md beside it).
import { asked, lineOf, drop, answered, nameOf } from 'mrepo-base-request'
import { Failure } from '../failure.js'

export async function request (root, command, { uri, reply, from = 'terminal', timeout = 120, every = 200 }) {
  // the command, a request: its line as typed (its words written as one),
  // who asks, the mrepo it is for, where its answer goes; dropped as
  // everyone drops one, a record around it, its offset given as it
  // arrives (the folder's lock), the file written whole: the runtime
  // never sees half of one
  const offset = drop(root, uri, asked(Array.isArray(command) ? lineOf(command) : command, { from, to: uri, reply }))
  // its answer: the request returned, in the outbox folder under the same
  // offset, waited for by watching the folder: looked at when something is
  // written there, and every `every` all the same (an event missed, a
  // folder that cannot be watched)
  const text = await answered(root, offset, { timeout, every })
  if (text === null) throw new Failure(`no response in ${timeout} s (the request stays: ${nameOf(offset)})`, 4)
  return { key: nameOf(offset), text }
}
