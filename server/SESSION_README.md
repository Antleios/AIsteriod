# Training Session Backend

## Scope

`TrainingSession` records one patient training visit. It is deliberately
separate from `AuthSession`: logging out or expiring a cookie must never remove
training history. The durable relation is:

```text
User → TrainingSession → GameRun → GameRunQuestion → GameAttempt
                         ├→ InteractionEvent
                         ├→ ConversationTurn
                         └→ SessionSummary
```

All internal game codes use the live API names: `object-naming`,
`emoji-match`, and `color-line`.

## Lifecycle and Integrity

A session is `ACTIVE`, then `FINALIZING`, then `COMPLETED`. Only an authenticated
`PATIENT` who owns an active session can append game attempts, events, or
conversation turns. `finalize` freezes writes, computes deterministic metrics,
and saves a doctor-facing summary. A run receives a snapshot of its question
payload and private answer when it is created, so later seed-bank edits cannot
change historical scoring. Client responses never contain object answers or
emoji `isCorrect` flags; the API evaluates attempts server-side.

## API Flow

All routes require the login cookie and are under `/api/training`:

```text
POST /sessions                              create visit
POST /sessions/:id/game-runs                body: { "gameCode": "emoji-match" }
POST /sessions/:id/questions/:qid/attempts  body: { "answer": "42", "responseTimeMs": 2100 }
POST /sessions/:id/events                   body: { "events": [...] }
POST /sessions/:id/conversation-turns       persist ASR/text or assistant turn
POST /sessions/:id/finalize                 calculate metrics and summary
GET  /sessions/:id, /sessions/:id/summary, /trends
```

Events require a stable `clientEventId`; re-sending the same event is
idempotent. Supported types include `CORRECT`, `WRONG`, `LONG_IDLE`,
`USER_MESSAGE`, and `GAME_COMPLETE`. Record actual client timestamps in
`occurredAt` and idle duration in `data.idleDurationMs`.

Doctor access is explicit: an `ADMIN` creates `POST /care-assignments` with a
`clinicianId` and `patientId`; an assigned `DOCTOR` may call
`GET /doctor/patients/:patientId/sessions` or `GET /doctor/sessions/:id`.
These doctor endpoints return metrics and summary only, never raw turns.

## Summary Provider and Privacy

`AI_PROVIDER=deterministic` is the offline default used in tests. Set
`AI_PROVIDER=qwen` plus `QWEN_API_KEY` to generate the same structured summary
through Qwen; the request is limited to computed metrics and the last ten user
turns. The prompt prohibits diagnosis and long-term psychological inference.
Raw turns remain in the database for authorized future review, but list and
trend endpoints return summaries/metrics rather than transcript content.

Apply the migration before use:

```bash
npx prisma migrate deploy
npm run db:seed
npm test
```
