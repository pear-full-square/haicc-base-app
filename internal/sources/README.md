# sources

Reads and writes the lists of registered sources, and answers the haicc sources command.

Two lists, a file each in haicc's own folder, a line a source: the
internal, `sources.list`, the install's folders (`folder:<path>`), what
the platform reads; the external, `external.list` (`github:<org>`), a
record of where each download came from, never handed inside; nothing
reads it to act on it yet. A line in
`sources.list` that is no folder (an install made before the split kept
`github:haiccing` there) is not read; `haicc sources` says so, and
`unlink` takes it off.

## Signature

- `sources(home)`: the lists in that folder.
- `sourcesCommand(home, args, { err })`: `haicc sources <args>`; `err`
  takes a line for stderr.

## Returns

`sources` returns:

- `folders()`: the internal list's folders, in the order linked.
- `external()`: the external list's lines.
- `unread()`: the internal list's lines that are no folder.
- `find(name)`: a file's path in the first folder that holds it, or null.
- `register(entry)`: a line added once, to its list (a folder to the
  internal, any other kind to the external).
- `unregister(entry)`: a line taken off whichever list holds it.
- `shown()`: what `haicc sources` prints: the folders, then the
  external lines, then each line not read, said.

`sourcesCommand` returns the lines to print.

## Actions

| | |
|---|---|
| `haicc sources` | the sources registered: the internal list's folders, then the external list, then what is not read, said |
| `haicc sources unlink <folder>\|<source>` | taken off its list: a folder (as written, when it is gone), or a line as listed (`github:<org>`, a line not read) |
| `haicc sources download <org>...` | what the first step does not take: a package alone (`<org>/<package>`) is never downloaded, its organisation is |

## Errors

- An action that is not there, or its arguments wrong: a `Failure`, exit
  code 2.
- A download that comes to the app: each said, then a `Failure` with
  exit code 3. Bare and the organisations are downloaded by the
  platform's first step, before Bare (`base-linux-haicc`); a package is
  downloaded with its organisation, not alone.

## Design

Linking a folder and downloading are not here: they are needed before
Bare is on the machine, so they belong to the platform's first step. They
write the same lists: a link the internal, a download both (the folder
it fills, the source it fetched from).
