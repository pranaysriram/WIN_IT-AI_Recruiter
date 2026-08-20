# Project structure

The reference layout uses a separate `frontend/` + `backend/` Express split.
This app is a single full-stack TanStack Start deployment, so the same layers
exist as folders inside `src/` — the router requires page files to live in
`src/routes/`, everything else mirrors the reference tree one-to-one.

```text
src/
├── components/      Navbar, Sidebar, CandidateCard, CallStatus,
│                    TranscriptViewer, InterviewCard, AppShell
├── routes/          Dashboard (index), Candidates, CandidateDetails,
│                    Calls, Interviews, Settings, Auth  (= pages/)
│   └── api/public/  raw HTTP endpoints (ElevenLabs post-call webhook)
├── services/        api (client data layer), elevenLabsService,
│                    twilioService, openAIService, calendarService, atsService
├── controllers/     candidateController, callController, interviewController
├── middleware/      auth, errorHandler, rateLimiter
├── db/              connection, callRepository, schema.sql
└── utils/           logger, validation
```

Mapping to the reference tree:

| Reference | Here |
| --- | --- |
| `frontend/src/pages/*.jsx` | `src/routes/*.tsx` (thin route wrappers) |
| `frontend/src/services/api.js` | `src/services/api.ts` |
| `backend/src/routes/*.js` | `src/routes/api/**` + server functions |
| `backend/src/controllers/*.js` | `src/controllers/*.ts` |
| `backend/src/services/*.js` | `src/services/*.server.ts` |
| `backend/src/middleware/*.js` | `src/middleware/*.ts` |
| `backend/src/db/*` | `src/db/*` |
| `backend/src/utils/*` | `src/utils/*` |
| `backend/src/server.js` | managed by the platform (serverless runtime) |

`assemblyAIService` is intentionally absent: ElevenLabs returns the final
transcript in its post-call webhook, so no separate STT pass is needed.
