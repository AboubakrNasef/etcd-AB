# etcd Server Lessons

This is a source-reading course for the server Go module. Follow the lessons in
order. Each lesson explains purpose, important components, data flow, ownership
boundaries, source-reading order, and exercises.

## Learning path

1. [Overview](./lessons/00-overview.md)
2. [Process entry points](./lessons/01-process-entry-points.md)
3. [Embedding and configuration](./lessons/02-embedding-and-configuration.md)
4. [Bootstrap and recovery](./lessons/03-bootstrap-and-recovery.md)
5. [Core server lifecycle](./lessons/04-core-server-lifecycle.md)
6. [Request application](./lessons/05-request-application.md)
7. [MVCC storage](./lessons/06-mvcc-storage.md)
8. [Durability](./lessons/07-durability.md)
9. [Membership and maintenance](./lessons/08-membership-and-maintenance.md)
10. [Authentication and leases](./lessons/09-auth-and-leases.md)
11. [API contracts](./lessons/10-api-contracts.md)
12. [Following Put](./lessons/11-following-a-put.md)
13. [Testing and exercises](./lessons/12-testing.md)
14. [Raft in this project](./lessons/13-raft-in-this-project.md)

Read one lesson, open its source links, and answer its checkpoint before moving
on. The source is authoritative; this folder is a navigational lesson plan.
