# test/

The tests of haicc-base-app, a section per file, each test by its name.

## `command.test.js`

- a command for the mrepos: at the root written plain, elsewhere the haicc command as it is
- the machine level, the usage, the sources
- refused, exit 2: not a command, or its arguments wrong

## `main.test.js`

- a continuation: what is returned says what to go on with, a script: sent on as haicc/script where it was answered for; what it says printed
- the usage; not a command: exit 2, said on stderr
- nothing booted: an mrepo command says so, exit 3; the teardown a repeat, a warning, exit 0; a deploy without the boot component in the sources
- haicc sources: printed a line a source
- boot/deploy: the boot handed the internal list's folders only, in order; a github: line in either list never handed
- a command for the mrepos: what it says printed, with what is attached; the whole request, or its record as stored, by a flag; failed, exit 1; not returned, exit 5; none in time, exit 4
- boot/teardown: what boot/deploy put in place removed, the packages' scripts too, nothing else; no runtime running: none stopped; twice: a repeat
- the install's scripts: haicc scripts lists them; haicc/file <URI> <name> reads one here and sends it as haicc/script

## `print.test.js`

- unpack: what fits stays as stored, what does not is opened, its entries packed on lines
- unpack: nothing of a record changed, at any width
- outcome: what a record's request returned: its status, what is said, its attachments; its continuation; not returned: none

## `request.test.js`

- request: the record written, value by value; its answer read as stored
- request: its response seen as it arrives: the outbox folder watched, not looked at on a clock
- request: no response in time: exit 4, the offset said; the request stays

## `sources.test.js`

- sources: two lists, the internal its folders in the order linked, the external apart; a line not read said; a file in the first folder that holds it
- haicc sources: the lists, unlink from either, https and no-https gone, download
