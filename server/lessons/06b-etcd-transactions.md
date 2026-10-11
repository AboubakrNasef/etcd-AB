# etcd transactions: comparisons and atomic operations

This lesson explains how an etcd KV transaction chooses a branch, applies its
operations, and relates to MVCC revisions and Raft. It complements
[Lesson 06: MVCC Storage](06-mvcc-storage.md) and the
[MVCC record walkthrough](06a-mvcc-record-followup.md).

## What an etcd transaction means

An etcd transaction is a request with three parts:

```text
If:   comparisons
Then: operations if every comparison is true
Else: operations if at least one comparison is false
```

The server evaluates the comparisons against one logical state, chooses one
branch, and executes that branch. It does not execute both `Then` and `Else`.
The selected operations are processed as one transaction, so other operations
do not observe a partially applied branch.

## Example: create a key only if it is absent

Suppose a client wants to create `lock = "worker-7"` only if the key does not
already exist:

```text
If:
  CreateRevision("lock") == 0
Then:
  Put("lock", "worker-7")
Else:
  Get("lock")
```

For an absent key, its create revision is zero, so `Then` is selected and the
Put creates it. If the key exists, its create revision is nonzero, so `Else`
is selected and the transaction returns the existing value. The comparison
and the chosen operation are part of one transaction, avoiding a separate
check-then-put gap.

## The comparison fields

A comparison names a key (or key range), a target, a relation, and a value to
compare. Common targets include:

- `Value`: compare the stored bytes;
- `CreateRevision`: compare when this key lifetime began;
- `ModRevision`: compare when the key last changed;
- `Version`: compare how many puts the current key lifetime has had;
- `Lease`: compare the attached lease ID.

Relations include equal, not equal, greater than, and less than. For example:

```text
If: ModRevision("account") == 12
Then: Put("account", "updated")
Else: Get("account")
```

This is a compare-and-set pattern: write only if the key has not changed since
the client observed revision 12. The actual protobuf includes typed fields and
range support; consult the API definitions for the precise encoding and
validation rules.

## Transaction operation types

The branches can contain operations such as:

- `Range` (read keys);
- `Put` (write a value);
- `DeleteRange` (delete one key or a range);
- nested `Txn` (evaluate another transaction).

The API places limits on transaction size and nesting. A transaction may mix
reads and writes in its selected branch. Reads in the transaction see the
appropriate transaction state according to etcd's transaction semantics; for
exact details, follow the implementation and tests listed below.

## Follow a transaction through the server

For a state-changing transaction, trace these stages:

1. **Client request:** The KV Txn RPC carries `If`, `Then`, and `Else`.
2. **RPC handling:** The v3 RPC layer validates and authorizes the request,
   then delegates it to the server.
3. **Proposal:** The server submits a state-changing request through Raft.
   A request being proposed is not yet an applied database change.
4. **Commit:** Raft orders the entry and determines when it is committed.
   Healthy members apply committed entries in the same order.
5. **Apply:** The apply layer decodes the committed request and dispatches the
   transaction implementation.
6. **Compare and select:** The transaction implementation evaluates `If`
   against the MVCC view and selects exactly one branch.
7. **Execute selected branch:** It runs that branch's operations in order.
   Writes are collected in an MVCC write transaction.
8. **End and respond:** MVCC finalizes writes, assigns revision metadata,
   persists backend changes, and prepares events. The server returns the
   selected branch and its operation responses.

Read-only requests can take a coordinated read path rather than proposing a
Raft log entry. Follow the current RPC and server code to distinguish that path
from a transaction that changes state.

## How the revision works

If a selected branch changes data, its changes are grouped under one Main
revision. Multiple mutations in the same transaction may have different Sub
revisions to order them within that Main revision:

```text
Txn at Main revision 20:
  Put alpha → (20, 0)
  Put beta  → (20, 1)
  Delete gamma → (20, 2)
```

This means a read cannot see only `alpha` from this transaction while missing
`beta` because the transaction was half-applied. The revision model also lets
watches associate the events with the same atomic operation.

An unsuccessful comparison does not itself change key data. If the selected
branch contains only reads, no key-value mutation is made. Check current
revision bookkeeping in the implementation when you need the exact behavior
for a particular no-op or metadata-only transaction.

## Transaction response

The response indicates whether the comparisons succeeded and contains the
responses for the branch that ran. For example, `Succeeded = true` means the
`Then` branch ran; `false` means the `Else` branch ran. It does not mean every
operation in that branch returned application-level success: inspect each
operation response and any RPC error behavior.

## What makes this atomic?

There are two related boundaries:

- **Raft ordering:** committed requests reach the replicated state machine in
  a consistent order across members.
- **MVCC write transaction:** operations from the selected branch are applied
  as a coherent group with a shared Main revision and backend transaction
  boundary.

Raft decides the authoritative order. The apply and MVCC layers implement the
transaction's state change and visibility.

## Source reading path

Follow these files and compare the transaction path with a simple Put:

1. [Txn protobuf definitions](../../api/etcdserverpb/rpc.proto) — locate
   `TxnRequest`, comparisons, operations, and response messages.
2. [KV RPC implementation](../etcdserver/api/v3rpc/key.go) — find the Txn
   handler and request checks.
3. [Server request handling](../etcdserver/v3_server.go) — trace delegation,
   proposal, and response conversion.
4. [Committed request application](../etcdserver/apply/apply.go) — find
   transaction dispatch after Raft commitment.
5. [Transaction implementation](../etcdserver/txn/txn.go) — inspect compare
   evaluation, branch selection, operation execution, and response assembly.
6. [MVCC transaction code](../storage/mvcc/kvstore_txn.go) and
   [watchable wrapper](../storage/mvcc/watchable_store_txn.go) — see how writes
   are collected, finalized, and made visible to watches.

Useful tests: [transaction tests](../etcdserver/txn/txn_test.go),
[MVCC store tests](../storage/mvcc/kvstore_test.go), and the
[API transaction tests](../etcdserver/api/v3rpc/key_test.go).

## Trace exercise

Use this scenario and fill in the actual revisions from the code or a local
run:

```text
Initial state: score = "10"

Txn:
  If: ModRevision("score") == observed_revision
  Then:
    Put score = "11"
    Put last-updated-by = "worker-7"
  Else:
    Get score
```

Answer these questions:

1. Which branch runs if `score` has not changed?
2. What happens if another writer changed `score` first?
3. Do the two Then-branch puts share a Main revision?
4. Which layer orders this request against other committed writes?
5. Which layer assigns MVCC revisions and writes the key records?
6. Which operations appear in the response?

When done, draw the path as:

```text
Txn RPC → server/Raft → committed apply → compare/select branch
        → MVCC write transaction → backend + watch events → response
```
