# godraft

A secure personal clipboard for moving notes and code between devices (e.g. your
machine ↔ a corporate VDI). No accounts — a shared **secret** is the room key.
Everything syncs live over Supabase Realtime.

## Setup

1. Create a Supabase project.
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql).
3. `cp .env.example .env` and fill in your project URL + anon key
   (Project settings → API).
4. Install and run:

```bash
npm install
npm run dev
```

Open the app, type a secret → workspace opens. Open the same URL + same secret on
another device to sync instantly.

## How it works

- The secret is SHA-256 hashed in the browser; the hash is the `workspace` key.
  The server never sees the raw secret. Access is gated by the secret being
  unguessable — see the note in `schema.sql`.
- Notes autosave (debounced) and stream to every connected device via Postgres
  changes.
- Editor has a plain-text mode (preserves spacing/indentation) and a code mode
  (CodeMirror: syntax highlighting, line numbers, bracket matching) for Go, TS,
  JS, JSON, SQL, YAML, and Bash.

## Architecture

Feature-based, UI kept separate from data/logic:

```
src/
  app/                     App shell + routing between gate and workspace
  features/
    workspace/             secret → workspace hook + SecretGate
    notes/                 types, service (Supabase CRUD), useNotes (realtime), sidebar
    editor/                EditorPane, CodeArea, language mapping
  shared/
    lib/                   supabase client, cn/hash/time utils
    components/ui/         button, input (shadcn-style)
```

## Shortcuts

- `Ctrl/Cmd+K` — focus search
- `Ctrl/Cmd+N` — new note
- `Ctrl/Cmd+Shift+C` — copy current note
- `Ctrl/Cmd+S` — no-op (autosave is always on)
