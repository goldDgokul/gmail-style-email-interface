# Email Interface

A single-context Gmail-style email UI. All data is in-memory mock; there is no backend, no auth, and no external API.

## Language

**Email**:
The aggregate unit stored and displayed by the application. Exactly one message, independent of any others.
_Avoid_: Message, mail, item

**View**:
A named predicate over the set of emails — what a sidebar destination selects. Views are filters, not storage locations.
_Avoid_: Folder, mailbox, category, screen

**Label**:
The umbrella term for any mark attached to an email.
_Avoid_: Tag, category, mark

**System Label**:
A label the service creates and destroys as part of email operations. Users never manage these directly.
_Avoid_: Folder, location, bucket

**Container**:
A system label that says where an email *is*. An email has at most one, and moving between containers is a single change of state.
_Avoid_: Folder, location, bucket

**Flag**:
A system label that says something *about* an email. Flags combine freely and have no mutual exclusion.
_Avoid_: Attribute, marker, badge

**User Label**:
A label supplied as seed data, with no interface for creating or editing labels. Selecting one opens a View of the emails carrying it.
_Avoid_: Custom tag, personal label

**Draft**:
An email being composed that has not been sent. It is data rather than mail — no recipients of record and no place among sent correspondence — so it is excluded from All Mail and is destroyed outright rather than held in Trash.
_Avoid_: Message, unsent message

**Restore**:
Returning an email to the place it came from — from spam back to the inbox, from trash back to whatever held it before.
_Avoid_: Recover, un-delete, move back

**Snooze**:
Marking an inbox email to leave the inbox now and return at a stated future time. Resolved by reading the timestamp, not by a background job.

**Archive**:
Removing an email from the inbox without destroying it. The email remains findable everywhere else.
_Avoid_: Remove, file
