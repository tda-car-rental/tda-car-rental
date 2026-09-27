# Supabase migration policy

Migration SQL is append-only and immutable.

Every migration filename must follow:

```text
NNNNNN_MMDDYYYY-HHmm_purpose.sql
```

`NNNNNN` is a six-digit increasing sequence. `MMDDYYYY-HHmm` is the creation date and 24-hour creation time in Asia/Manila. `purpose` is lowercase ASCII with underscores.

After a migration is committed, its SQL file must not be edited, renamed, or deleted. A correction is a new migration with the next sequence number and a new creation timestamp. The migration verifier and CI reject changes to existing SQL files.
