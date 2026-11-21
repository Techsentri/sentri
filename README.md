# SENTRI_

SENTRI is a wallet-scoped application for **offchain policy evaluation** in autonomous finance. Register agent identities, define transaction-intent policies, and inspect deterministic ALLOW / REJECT decisions with a persistent audit history.

**Current status: working private beta.** Autonomous blockchain execution, EVM transaction simulation, transaction submission, and smart-contract-enforced restrictions are not implemented. An ALLOW decision does not authorize a wallet or guarantee onchain enforcement.

## Core capabilities

- Injected EVM wallet connection, EOA signature-based sign-in, Robinhood Chain network switching, and native balance retrieval.
- Wallet-owned agent registry with editable descriptions, activation status, and evaluation permission.
- Versioned policies for transaction amounts, expected slippage, approved tokens, approved destinations, and authorization status.
- Server-side validation and deterministic evaluation of structured transaction intents.
- Persistent evaluation records containing the wallet, agent, intent, decision, rule explanations, timestamp, and policy snapshot.
- Searchable audit history with decision filters and JSON export.
- Responsive interface with reduced-motion support.

Registering an agent creates an application identity. It does not deploy an AI process, establish an independently authenticated agent, or grant wallet access.

## Technology stack

- Next.js App Router and React
- TypeScript
- Custom CSS and Motion for React
- Viem and Zod
- Redis-compatible REST storage for production
- Local JSON-file storage for development only
- Node.js test runner with HTTP integration tests

There are no SENTRI smart contracts or contract deployment tools in this repository.

## Installation and local development

Use Node.js 24.x and npm.

```sh
git clone https://github.com/Techsentri/sentri.git
cd sentri
npm ci
```

Copy `.env.example` to `.env.local`, then configure the variables needed for your environment. Use `cp .env.example .env.local` on Unix-like shells or `Copy-Item .env.example .env.local` in PowerShell.

```sh
npm run dev
```

Open the local URL printed by Next.js. Set `APP_ORIGIN` to the exact origin used in your browser; `localhost` and `127.0.0.1` are different origins.

Without Redis configuration, development uses `.sentri/store.json`. This adapter serializes writes within one process and is unsuitable for multiple instances or production. Production storage operations fail closed when Redis is missing or unavailable.

## Environment variables

Names and purposes only; never commit real credentials.

| Variable | Purpose |
| --- | --- |
| `APP_ORIGIN` | Exact browser origin permitted for mutation requests; use HTTPS in production |
| `REDIS_REST_URL` | Custom Redis-compatible REST endpoint |
| `REDIS_REST_TOKEN` | Credential paired with the custom REST endpoint |
| `KV_REST_API_URL` | Alternative endpoint supplied by a compatible Vercel integration |
| `KV_REST_API_TOKEN` | Credential paired with the integration endpoint |
| `ROBINHOOD_RPC_URL` | Server-side Robinhood Chain RPC endpoint |
| `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | Public RPC endpoint used when adding the network to a wallet |
| `SENTRI_DATA_DIR` | Optional location for development-only file storage |
| `NODE_ENV` | Runtime environment, normally managed by the application framework |

Provide a complete Redis credential pair. Custom REST variables take precedence over the integration pair. Never put a private provider credential in a `NEXT_PUBLIC_` variable: those variables are exposed to browsers.

See [Robinhood's network documentation](https://docs.robinhood.com/chain/connecting/) for chain configuration. SENTRI targets chain ID 4663 and uses ETH as the native currency.

## Architecture

```text
Browser or HTTP client
  -> wallet-signature authentication and session cookie
  -> wallet-scoped Next.js Route Handlers
  -> server-side schemas and policy evaluator
  -> Redis REST persistence
     (single-process file adapter during local development)
```

The server derives ownership from the authenticated session. Callers cannot choose another owner by supplying a wallet address. Policy updates and workspace writes use version/revision checks to reject stale changes.

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/agents` | Agent registry |
| `/policies` | Policy administration |
| `/terminal` | Transaction-intent evaluation |
| `/activity` | Evaluation audit history |
| `/docs` | Product and technical documentation |
| `/simulator` | Redirect to the policy evaluator; not an EVM simulator |

## API overview

The API currently authenticates an owning wallet, not an independently delegated agent. Mutations require the matching `Origin` header and an authenticated session cookie.

| Endpoint | Behavior |
| --- | --- |
| `POST /api/auth/challenge` | Creates a short-lived wallet sign-in challenge |
| `POST /api/auth/verify` | Verifies an EOA signature and establishes a session |
| `GET /api/auth/me` | Returns the signed-in wallet or null |
| `POST /api/auth/logout` | Invalidates the session |
| `GET /api/workspace` | Retrieves the owning wallet's workspace |
| `POST /api/workspace` | Performs a validated, wallet-scoped action |

Workspace actions are `register`, `updateAgent`, `toggle`, `policy`, and `evaluate`. Requests use the envelope `{ action, data }`.

Evaluation inputs are `agentId`, `token`, `destination`, `amount`, `slippageBps`, and `chainId`. Amounts are decimal strings in token units; slippage is expressed in integer basis points. Use `native` for ETH. Standard ERC-20 symbols and decimals are verified through RPC when saving token policies; precision above 18 decimals is unsupported.

The evaluator checks network, agent status, agent permission, policy authorization, token allowlist, destination allowlist, amount, and expected slippage. Every rule must pass for ALLOW. New workspaces start with authorization paused and no approved destinations.

## Checks and production builds

**Run tests only with local, disposable configuration.** Remove both custom Redis variables and the `KV_REST_API_*` connection variables from the test environment. The current integration harness does not clear every provider alias automatically; never run it with production credentials available.

```sh
npm run typecheck
npm test
npm run build
```

```sh
npm start
```

Production hosting is configured for Next.js through `vercel.json`. Supply environment variables through the hosting provider's secure settings. With production variables loaded, `node scripts/check-production.mjs` checks the origin, RPC chain ID, and Redis commands. This command writes a temporary, expiring verification key; it is not a read-only check.

## Security limitations and implementation boundaries

- Policy evaluation checks submitted fields. It does not simulate calls, inspect arbitrary calldata, measure market slippage, route swaps, or broadcast transactions.
- ALLOW decisions are application records, not signed execution permissions. They are not bound to a future transaction by an executor, consumption nonce, or enforcement contract.
- Agent IDs are metadata identifiers, not credentials. No scoped agent SDK or autonomous execution service is provided.
- Sign-in supports EOA signatures. Smart-contract wallet signatures are currently unsupported. SENTRI never requests custody of private keys.
- Amount limits apply independently in each approved token's units. They are not USD valuations, cumulative budgets, or daily spending caps.
- Address allowlisting does not prove a destination is a contract or that its behavior is safe.
- Audit records are stored by the application, not immutably onchain. Administrative changes and the full execution lifecycle are not comprehensively audited.
- Current per-wallet limits are 50 agents, 20 approved tokens, 50 destinations, and 2,000 evaluations. Export does not reset the evaluation limit; archival is not implemented.
- Whole-workspace storage and responses constrain scalability. Authentication abuse controls, datastore isolation, recovery testing, and real-wallet browser coverage require further hardening before broader production use.
- Redis key prefixes prevent naming collisions; they do not replace datastore access controls. Use appropriately isolated credentials and infrastructure.

Do not treat this release as production-ready autonomous financial execution infrastructure.
