# request

Sends a command to an mrepo through its inbox folder and waits for the response in its outbox folder.

The command goes as a request (`mrepo-base-request`, `asked`): its line
as typed, who asks, the mrepo it is for, where its answer goes. It is
dropped as everyone drops one (`drop`): a record around it, addressed to
the mrepo's inbox, its offset given as it arrives, under the inbox
folder's lock, the record's name in both folders, in their folders by
its digits.

## Signature

`request(root, command, { uri, reply, from, timeout, every })`

- `root`: the mrepo's folder.
- `command`: the command: its words as typed, written as one line
  (`lineOf`), or the line itself.
- `uri`: the mrepo's unique URI: the request's `to`; the record's topic
  is `/<uri>/inbox`.
- `reply`: where the request returned goes back.
- `from`: who asks, `terminal`.
- `timeout`: seconds to wait, 120.
- `every`: milliseconds between two looks, 200. The outbox folder is
  watched: the response is read as it is written there; the looks are
  the net, for an event missed or a folder that cannot be watched.

## Returns

`{ key, text }`: the request's key, and the response record as it is
stored in the outbox folder.

## Errors

- No response in time: a `Failure` with exit code 4, saying the key. The
  request stays where it is.

## Design

The request is made and its record written with `mrepo-base-request`, as
an mrepo does it itself: written under a temporary name, then renamed, so the
runtime never sees half of one.
