# main

Runs one haicc command line: prints what it answers, says an error on stderr, returns the exit code.

The package's `run.js` calls it with the arguments, the environment and
the Bare running it, and exits with what it returns.

## Signature

`main(argv, { env, bare, io })`

- `argv`: the command line's parts, after `haicc`.
- `env`: the environment's variables, below.
- `bare`: the Bare to run the boot with; the one running this by default.
- `io`: `{ out, err, stdio, columns }`, a line printed, a line said on
  stderr, the stdio the boot is run with, and the terminal's width now
  (`null` when the output is none); the console, `inherit` and the
  console's terminal by default.

## Environment

- `HAICC_HOME`: haicc's own folder, `~/.haicc` by default.
- `HAICC_WORK`: the work folder, `<home>/work` by default.
- `HAICC_TIMEOUT`: seconds to wait for a response, 120.
- `HAICC_RAW=1`: the response record printed as stored, one line.
- `HAICC_REQUEST=1`: the whole request printed, its record unpacked.

The width the unpacked record is fitted to is no variable: `haicc
output` sets it (`output`).

## Returns

The exit code, a number.

## Design

- **A command for the mrepos**, `haicc <URI> <protocol>/<action>
  <argument>...`: a request, its line as typed, dropped into the root
  mrepo's inbox folder; what is returned printed: what it says, as it
  is, then what is attached, a line each (`Attached: <name> (<type>), at
  <where>`). With `--request` the whole request, its record unpacked
  across lines; with `--raw` the record as stored. Exit 0 when it is
  returned `done`; 1 when `failed`: what it says on stderr, nothing on
  stdout (a command its flags kept from being run is failed too).
- **A continuation**: a request returned done with a script to go on
  with (its processing's `continuation`) is followed: each of its commands sent from the position it is
  written at, after the response of the one before, each response
  printed as the first; where records are printed for reading, each
  command is said first, as it would be typed. The first that fails ends
  it, with its exit code. A continuation answered inside one is not
  run; one of more than 100 commands is refused.
- **The machine level**, `haicc boot/deploy` and `haicc boot/teardown`:
  above the root mrepo, in the same form.
- **Its own**: `haicc sources`, `haicc output`, the usage.
- Every failure is said as `haicc: <message>`.
