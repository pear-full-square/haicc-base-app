# outcome

Finds what a response record's request returned: its status, what is said, its attachments, its continuation.

The record is the transport's envelope; its value is the request, and
what is returned is the request's own.

## Signature

`outcome(text)`: the response record as stored.

## Returns

- `{ status, message, attachments }`: what the request returned: `done`
  or `failed`, what is said, its lines as they are, what is attached.
  With `continuation`, `{ at, script }`, when it is done and its
  processing holds a script to go on with (anything there that is no
  such thing is left out; none when it failed).
- `null`: the text is not a record, or its request is not returned.
