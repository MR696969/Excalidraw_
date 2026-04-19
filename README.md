# Excelidraw (week-22)

Collaborative drawing workspace: shapes sync over WebSockets, with a canvas UI built in Next.js (`apps/excelidraw-frontend`).

## Features

- **Tools:** rectangle, circle, and freehand **pencil** (strokes stored as point polylines).
- **Viewport:** **pan** and **zoom** so you can move around large boards and focus on detail.
- **Persistence:** shapes load from the HTTP backend and new strokes are broadcast to the room.

## Canvas controls

| Action | Input |
|--------|--------|
| Draw | Left mouse (after choosing a tool in the toolbar) |
| Pan | Middle mouse drag, or **Space** + left drag |
| Zoom | Mouse wheel (zooms toward cursor) |

Zoom level is clamped between 0.1× and 5×. Space is ignored for panning while typing in an input or contenteditable field.

## Repository layout

| Path | Role |
|------|------|
| `apps/excelidraw-frontend` | Next.js drawing UI (home, auth, `/canvas/[roomId]`) |
| `apps/http-backend` | REST API (e.g. chat/shape history) |
| `apps/ws-backend` | WebSocket server for room sync |
| `apps/web` | Separate Next.js app (chat room demo) |
| `packages/*` | Shared libraries (`ui`, `db`, `common`, etc.) |

## Development

Requires Node 18+ and [pnpm](https://pnpm.io).

Install and start all dev tasks via Turborepo:

```bash
pnpm install
pnpm dev
```

To run **only** the drawing frontend (default dev URL is usually [http://localhost:3000](http://localhost:3000); if another app uses 3000, Next will pick the next free port):

```bash
pnpm --filter excelidraw-frontend dev
```

**Backends:** real-time drawing and history expect `http-backend` (default **3002**) and `ws-backend` (default **8080**). Override hosts/ports with env vars consumed by `apps/excelidraw-frontend/config.ts`:

- `NEXT_PUBLIC_API_HOST`, `NEXT_PUBLIC_API_PORT` — HTTP API
- `NEXT_PUBLIC_WS_HOST`, `NEXT_PUBLIC_WS_PORT` — WebSocket URL

Other scripts: `pnpm build` (production build for all packages), `pnpm lint`, `pnpm format`.

## Assignment (completed)

- Complete pencil functionality — freehand strokes with `points[]`, rendering, and sync.
- Add panning and zooming — middle mouse / Space+drag pan; wheel zoom at cursor; world-space shapes with viewport transform.
