# Training Session Backend

## Scope

`TrainingSession` records one patient training visit. It is deliberately
separate from `AuthSession`: logging out or expiring a cookie must never remove
training history. The durable relation is:

```text
User → TrainingSession → GameRun → GameRunQuestion → GameAttempt
                         ├→ InteractionEvent
                         ├→ ConversationTurn
                         ├→ AiInteraction
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

## Patient Interaction LLM

`POST /api/ai/sessions/:sessionId/interactions` is the production path for
normal chat and selected game prompts. It requires an authenticated `PATIENT`,
an active owned session, and a stable `clientRequestId` for idempotency:

```json
{
  "clientRequestId": "chat-42",
  "trigger": "USER_MESSAGE",
  "context": "CHAT",
  "userText": "我不喜欢这个",
  "inputMethod": "ASR"
}
```

Supported triggers are `GAME_START`, `MULTIPLE_WRONG`, `LONG_IDLE`,
`USER_MESSAGE`, `USER_QUIT`, and `GAME_COMPLETE`. The server writes the user
turn (when present), loads only the latest 10 turns as short-term context, then
writes the assistant reply and an `AiInteraction` audit record. The model input
is the server-built `patient-interaction-input.v1` JSON object (event, game
state, user turn, and at most ten recent turns); it never receives arbitrary
prompt text from the client. The normalized output is:

```json
{
  "schemaVersion": "patient-interaction-output.v1",
  "reply": "好，我知道了。我们可以先停一下。",
  "emotion": "empathetic"
}
```

The HTTP response keeps top-level `reply` and `emotion` for compatibility and
also exposes the same object as `interaction.output`. The model cannot score
questions, reveal answers, or end a game. Ordinary correct/wrong feedback
should stay fixed text/TTS.

`POST /api/ai/chat` still returns `{ reply }` for the existing page, and now
also returns `output` plus `ai.prompt` metadata. It remains
available without login only while `AI_INTERACTION_PROVIDER=deterministic`; a
live Qwen provider requires a patient login to protect API quota.

## Summary Provider and Privacy

`AI_INTERACTION_PROVIDER=deterministic` and `AI_DOCTOR_PROVIDER=deterministic`
are the offline defaults used in tests. Set either to `qwen` plus
`QWEN_API_KEY` to enable that flow: interaction uses `QWEN_CHARACTER_MODEL`,
while summaries use `QWEN_DOCTOR_MODEL`. The legacy `AI_PROVIDER=qwen` remains
a fallback for both. Prompt definitions, their temperature, output schema, and
version are centralized in `src/services/aiPrompts.js`; select an existing
version with `AI_INTERACTION_PROMPT_VERSION` or `AI_DOCTOR_PROMPT_VERSION`.
Do not accept a prompt or prompt version from an HTTP request. Add and test a
new version in that registry before changing an environment value. Summary input
is also normalized as `doctor-summary-input.v1`; both flows persist their input,
output, provider, model, and prompt version for audit. Both prompts prohibit
diagnosis and long-term psychological inference.
Raw turns remain in the database for authorized future review, but list and
trend endpoints return summaries/metrics rather than transcript content.

Apply the migration before use:

```bash
npx prisma migrate deploy
npm run db:seed
npm test
```
