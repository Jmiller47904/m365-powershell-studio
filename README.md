# M365 PowerShell Studio

M365 PowerShell Studio is a VS Code-inspired workspace for building safer,
repeatable PowerShell automation across Microsoft 365.

The current experience includes:

- Entra ID, Exchange Online, Teams, SharePoint Online, Microsoft Graph, Intune,
  and Security & Compliance service libraries
- Editable PowerShell with lightweight syntax highlighting
- Guided script-builder controls for CSV-driven Entra ID user creation
- Microsoft Graph permission guidance and admin-consent notes
- WhatIf protection, validation, error handling, and disconnect cleanup in
  generated scripts
- Quick templates, recent scripts, terminal validation feedback, copy, and
  .ps1 export

## Run locally

Requirements: Node.js 22.13.0 or newer, Linux utilities flock, curl, and GNU
timeout.

```bash
npm ci
npm run dev
```

Open the local address printed by the development server. The production
artifact can be checked with:

```bash
npm run build
npm test
```

## Project structure

- app/page.tsx — editor, service explorer, builder panel, dialogs, and state
- app/globals.css — dark IDE layout and responsive styling
- app/layout.tsx — document metadata and font setup
- tests/ — rendered-artifact smoke tests
- scripts/ — bounded install, build, and artifact validation helpers

The generated scripts are intentionally designed to be reviewed and exported
before they are run against a tenant. They do not execute Microsoft 365
changes from the browser.

## Deployment strategy

This repository is the source of truth. ChatGPT Sites is only one optional
hosting target; the application does not require ChatGPT to run.

### Web

Run the Vinext server with npm run web:start after npm run build. The included
Dockerfile can be deployed to any container host that supports Node.js 22.
The same web app can also be adapted to a Node, Cloudflare, or other
JavaScript hosting provider.

The included web manifest and service worker make the app installable as a
standalone PWA in compatible browsers.

### Desktop

The Electron shell provides Windows, macOS, and Linux builds while reusing the
same web interface. During development:

    npm run desktop:dev

To launch the shell against a self-hosted web deployment:

    M365_STUDIO_URL=https://your-host.example npm run desktop

To build distributable installers:

    npm run desktop:dist

The shell accepts a URL through M365_STUDIO_URL or a --url command-line
argument. This keeps the desktop app independent of any single hosting vendor.

The generated PowerShell remains local to the browser or desktop shell. It is
reviewed and exported by the user before it is run against a tenant.

## Prerequisites

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

## Sites Lifecycle

The Sites lifecycle CLI runs the locked dependency install before returning this checkout. Edit the source under `app/`, then checkpoint when a coherent milestone is ready to inspect or share. The remote Sites builder runs `npm run build` against the pushed commit. Do not repeat install or build as a normal pre-checkpoint step.

This starter does not use `wrangler.jsonc`.

`install:ci` is intentionally a single, non-retrying `npm ci`. It refuses a concurrent install for the same project, consumes a matching image-seeded npm cache with `--prefer-offline` while retaining registry fallback for a missing cache object, otherwise downloads and verifies the complete vinext tarball recorded in `package-lock.json`, limits npm to one socket, and terminates a stalled install. `build` applies a short timeout and then validates the Sites artifact. These helpers target Linux and use GNU `timeout`; they are not native macOS scripts.

Scripts that need writable project-scoped home, npm, XDG, and temporary paths use `scripts/sites-env.sh`. The `dev` and `start` scripts honor the caller's runtime environment and keep Wrangler logs inside the checkout. The generated `.sites-runtime/` directory is disposable and ignored by Git.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Diagnostic Commands

- `npm run install:ci`: perform the one bounded lockfile install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build and validate the deployable Sites artifact
- `npm run start`: start the built Vinext application
- `npm test`: build, validate, and verify the rendered development-preview metadata
- `npm run validate:artifact`: recheck an existing artifact's manifest and ESM `default.fetch` export
- `npm run db:generate`: generate Drizzle migrations after schema changes

Use build and validation commands for targeted diagnosis after a remote failure, not as part of the normal checkpoint path.

The timeout defaults can be overridden for a controlled canary with `SITES_INSTALL_TIMEOUT`, `SITES_INSTALL_KILL_AFTER`, `SITES_BUILD_TIMEOUT`, and `SITES_BUILD_KILL_AFTER`. A timeout fails the command; the helpers never retry an unchanged install or build.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

## CSV preflight (CLI preview)

Before reviewing/exporting a user-creation script, run:

```bash
node scripts/csv-preflight.mjs users.csv
node --test tests/csv-preflight.test.mjs
```

This dependency-free local tool checks the existing CSV contract:
`DisplayName,UserPrincipalName,MailNickname,TemporaryPassword`. It handles quoted
commas, doubled quotes, multiline fields, BOM and CRLF. It reports row numbers,
missing fields, basic UPN/alias problems and case-insensitive duplicates. All rows
sharing a duplicate UPN are blocked. It never connects to a tenant or runs PowerShell.
Exit codes: 0 = locally ready for review, 2 = blocked/empty plan, 1 = malformed input
or unreadable file. Output contains names/UPNs; save or share it intentionally.
Passwords and unknown column values are never included in reports.

A successful preflight does not verify domain ownership, existing tenant accounts,
full Graph property rules, password strength/policy or effective permissions. The
source CSV is still sensitive. Review the script and run it with `-WhatIf` first;
this does not simulate Graph-side validation. No automatic rollback is offered.

[Microsoft Create user documentation](https://learn.microsoft.com/en-us/graph/api/user-post-users?view=graph-rest-1.0),
verified October 1, 2026, lists `User.Create` for delegated and application access.
The existing generated script requests the broader `User.ReadWrite.All`; the report
makes this distinction explicit. This increment provides a reusable ES module and
CLI; browser file upload/preview and integration with script generation are next.
