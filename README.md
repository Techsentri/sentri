# SENTRI_

The execution firewall for autonomous finance.

## Current delivery state

Backend and wallet-adapter source only. The approved visual references have not been supplied; the landing and all six product pages are intentionally pending. This is not a deployed release.

Implemented: wallet-signature authentication, wallet-scoped agent registry and permissions, policy updates with optimistic concurrency, token metadata validation through Robinhood Chain RPC, deterministic policy decisions, and persistent evaluation records with exact policy snapshots.

The browser adapter supports injected EIP-1193 wallets, network switching, native balance retrieval, sign-in, and account/network change listeners. It is not yet connected to a user interface. Automated adapter tests use provider doubles; no live browser wallet has been verified.

## Run

Requires Node.js 20.9 or later.

```sh
npm ci
npm run dev
```

Development uses an ignored `.sentri/store.json` file. This adapter serializes writes within one process; it is not intended for multiple processes or production. `SENTRI_DATA_DIR` can select a development data directory.

```sh
npm test
npm run typecheck
npm run build
```

Tests compile with TypeScript and use Node's test runner. HTTP tests start an isolated Next.js development server, create ephemeral local signing keys, and use a separate data directory. Test keys are never funded, persisted, or logged.

## Production configuration

Copy `.env.example` to `.env.local` for local configuration. Production requires:

- `APP_ORIGIN`: exact HTTPS origin of the Vercel deployment.
- `REDIS_REST_URL` and `REDIS_REST_TOKEN`: an Upstash-compatible Redis REST endpoint supporting GET, GETDEL, SET, and EVAL.
- `ROBINHOOD_RPC_URL`: server RPC endpoint; may contain a private provider credential.
- `NEXT_PUBLIC_ROBINHOOD_RPC_URL`: public RPC URL for wallet network configuration; never use a credential here.

Production requests fail closed with HTTP 503 when Redis is absent. Redis credentials stay server-side. Configure database access, backups, retention, and monitoring before use. The Redis adapter has not been exercised against a provisioned service in this workspace.

Vercel project preset: Next.js. Build: `npm run build`. No custom output directory. No GitHub remote, Vercel project, production Redis credentials, or deployed URL has been supplied.

## API

All mutation requests require an exact matching `Origin` header. The authenticated wallet always comes from an HttpOnly, SameSite=Strict cookie. Production cookies are Secure. A session expires after 12 hours. Sign-in challenges expire after five minutes and are consumed once, including on a failed signature.

| Endpoint | Behavior |
| --- | --- |
| `POST /api/auth/challenge` | `{wallet}` returns a nonce and human-readable sign-in message |
| `POST /api/auth/verify` | `{nonce, signature}` verifies an EOA personal-sign signature and creates a session |
| `GET /api/auth/me` | Returns the authenticated wallet or null |
| `POST /api/auth/logout` | Invalidates the session on the server |
| `GET /api/workspace` | Returns only the authenticated wallet's agents, policy, and evaluations |
| `POST /api/workspace` | `{action, data}` performs a validated wallet-scoped operation |

Workspace actions:

- `register`: `{name, description, canEvaluate}`.
- `updateAgent`: `{id, name, description, canEvaluate}`.
- `toggle`: `{id}` changes an owned agent's active status.
- `policy`: `{expectedVersion, maxAmount, maxSlippageBps, tokenAddresses, contracts, authorization}`. Tokens use `native` for ETH or a valid ERC-20 address. ERC-20 decimals and symbols are fetched server-side on chain 4663. Precision above 18 decimals is unsupported.
- `evaluate`: `{agentId, token, destination, amount, slippageBps, chainId}`. Returns a workspace with the new ALLOW/REJECT record first in `history`.

Amounts are decimal strings in the selected token's units. The same numeric policy limit applies independently to each approved token; this is not a USD valuation, aggregate budget, or daily cap. Slippage uses integer basis points. Maximum limits are inclusive. Unknown tokens and inactive, missing, foreign, or unauthorized agents are rejected. New wallets start with authorization paused and an empty destination list.

Every evaluation records its ID, time, wallet, network, agent ID/name, policy version and snapshot, normalized intent, and rule explanations. These are application records, not an immutable onchain log. Limits: 50 agents, 20 approved tokens, 50 destinations, 2,000 evaluations per wallet. The evaluation limit prevents further evaluations without deleting prior records. Export/archival UI remains pending.

## Security and execution boundaries

Agent registration and policy ALLOW decisions grant no wallet permissions. Decisions validate submitted intent fields; they do not simulate EVM calls, obtain swap quotes, verify actual market slippage, or enforce rules against transactions submitted elsewhere.

No transaction submission, swap execution, contract deployment, arbitrary calldata handling, private-key custody, or token-approval feature is implemented. Consequently, no transaction hashes or invented onchain records are generated. Smart-contract wallet signatures are not supported in the initial EOA login flow.

State mutations use wallet-scoped keys and atomic revision checks. Concurrent stale writes return HTTP 409. Request bodies are bounded to 32 KiB. RPC and storage failures return sanitized messages. Redis access is never available directly to the browser.

Network configuration follows [Robinhood's official connection documentation](https://docs.robinhood.com/chain/connecting/): chain ID 4663, ETH gas, [Blockscout explorer](https://robinhoodchain.blockscout.com).
