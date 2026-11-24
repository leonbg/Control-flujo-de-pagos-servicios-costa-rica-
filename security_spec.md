# FlujoPago Firestore Security Specification

## 1. Data Invariants
1. Every document lives under `/users/{userId}` where `userId` MUST strictly equal `request.auth.uid` and the user MUST have `request.auth.token.email_verified == true`.
2. Every `PaymentRule` and `PaymentLog` document cannot exist without a valid parent `/users/{userId}` document (`existsAfter` on create, `exists` on update/delete) whose `uid` matches `request.auth.uid`.
3. No user can list, read, create, update, or delete another user's settings, payment rules, or payment logs.
4. `ownerId`, `uid`, and `createdAt` are immutable once created, and all `createdAt`/`updatedAt` timestamps MUST equal `request.time`.
5. All string fields are strictly bounded by `.size()` limits, dates must match `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`, amounts must be positive (`> 0 && <= 100000000`), and shadow/unknown keys are rejected via `keys().hasOnly(...)` and `affectedKeys().hasOnly(...)`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read/write**: `auth = null` attempting `get /users/userA/rules/r1`.
2. **Unverified email spoofing**: `auth = { uid: "userA", token: { email_verified: false } }` attempting `create /users/userA`.
3. **Cross-tenant read**: `userB` attempting `get /users/userA/rules/r1` or `list /users/userA/rules`.
4. **Identity spoofing on create**: `userA` creating `/users/userA/rules/r1` with `ownerId: "userB"`.
5. **Shadow field injection**: `userA` creating `/users/userA` with extra field `isAdmin: true`.
6. **ID poisoning**: `userA` creating `/users/userA/rules/bad$id..with..chars` or a 500-char ID.
7. **Orphaned subcollection write**: `userA` creating `/users/userA/rules/r1` when `/users/userA` does not exist and is not created in the same batch.
8. **Client-forged timestamp**: `userA` creating `/users/userA/rules/r1` with `createdAt` set to a past client timestamp instead of `request.time`.
9. **Immutable field mutation**: `userA` updating `/users/userA/rules/r1` to change `ownerId` or `createdAt`.
10. **Negative / zero amount poisoning**: `userA` creating `/users/userA/rules/r1` with `amount: -500` or `amount: "1000"`.
11. **Oversized string / Denial-of-Wallet**: `userA` creating `/users/userA/rules/r1` with `notes` > 500 chars or `title` > 120 chars.
12. **History tampering**: `userA` attempting `update` on `/users/userA/logs/l1` (settled logs are immutable).
