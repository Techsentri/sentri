# SENTRI_

The execution firewall for autonomous finance.

## Current delivery state

The landing, Execution Terminal, Agent Registry, Policy Engine, Audit Trail, and Documentation are implemented. `/simulator` routes to the real intent evaluator in `/terminal`. All authenticated product screens use the existing server APIs; no browser-local persistence or artificial blockchain confirmations are introduced.

The supplied reference path `design-reference/sentri-approved.png` does not currently contain a file. The frontend follows the written black/orange/cyan/purple/green editorial direction; comparison with the locked image is a separate outstanding check and does not block deployment.

Implemented: wallet-signature authentication, wallet-scoped agent registry and permissions, policy updates with optimistic concurrency, token metadata validation through Robinhood Chain RPC, deterministic policy decisions, and persistent evaluation records with exact policy snapshots.

The browser adapter is connected to the interface with EIP-6963 provider discovery and an injected-wallet fallback, network switching, native balance retrieval, signed login, and account/network change handling. Automated tests cover provider behavior and real ephemeral EOA signatures; a live MetaMask account has not been verified in the available in-app browser, which has no installed wallet.

The responsive motion system includes hero text entrance, independently floating geometric symbols, pointer parallax, scroll reveals, interactive labels and buttons, evaluation status transitions, and route entrances. Reduced-motion preferences disable nonessential motion, and the hero renders without network assets.

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
- `REDIS_REST_URL` and `REDIS_REST_TOKEN`, or Vercel-managed `KV_REST_API_URL` and `KV_REST_API_TOKEN`: an Upstash-compatible Redis REST endpoint supporting GET, GETDEL, SET, and EVAL. A complete pair is required; credentials from different pairs are never mixed.
- `ROBINHOOD_RPC_URL`: server RPC endpoint; may contain a private provider credential.
- `NEXT_PUBLIC_ROBINHOOD_RPC_URL`: public RPC URL for wallet network configuration; never use a credential here.

Production requests fail closed with HTTP 503 when Redis is absent. Redis credentials stay server-side. SENTRI uses the `sentri:v1:` Redis key prefix, including for wallet data, sessions, challenges, and rate limits, to isolate its records from other applications using the resource.

Vercel project: `sentri`, linked to this checkout. Assigned production origin: `https://sentri-tau.vercel.app`. `vercel.json` configures `npm ci` and `npm run build`; the project uses Node.js 24.x to match local validation. No custom output directory or GitHub remote is configured.

The existing Upstash resource `equity-void-auth` is connected to SENTRI's production environment using provider-managed `KV_REST_API_URL` and `KV_REST_API_TOKEN`. The production origin and public Robinhood RPC settings are configured in Vercel. No credentials are committed. Deployment readiness and live behavior must be confirmed by Vercel status and production smoke tests, rather than inferred from these settings.

After configuring production environment variables, verify them in an environment that has those variables loaded:

```sh
node scripts/check-production.mjs
```

This verifies the HTTPS origin, isolated Redis read/write and atomic operations, and RPC chain ID. It never prints credentials or modifies wallet records. Its temporary Redis key expires after 30 seconds.

Complete Vercel authentication and deployment from this project directory:

```sh
npx --yes vercel@65.11.0 --global-config ../../work/vercel-config login
npx --yes vercel@65.11.0 --global-config ../../work/vercel-config link --yes --project sentri
npx --yes vercel@65.11.0 --global-config ../../work/vercel-config env add REDIS_REST_URL production
npx --yes vercel@65.11.0 --global-config ../../work/vercel-config env add REDIS_REST_TOKEN production
npx --yes vercel@65.11.0 --global-config ../../work/vercel-config env add APP_ORIGIN production
npx --yes vercel@65.11.0 --global-config ../../work/vercel-config deploy --prod --yes
```

Enter credentials through the CLI prompts or Vercel's environment-variable settings, never shell arguments or chat. Set APP_ORIGIN to the deployment's exact canonical HTTPS origin. If Node reports a certificate-chain error on this workstation, enable the system certificate store for the CLI process with `NODE_OPTIONS=--use-system-ca`; do not disable TLS verification. The checkout-local CLI configuration above is outside the Git repository and contains authentication state, so keep it private.

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

Every evaluation records its ID, time, wallet, network, agent ID/name, policy version and snapshot, normalized intent, and rule explanations. These are application records, not an immutable onchain log. Limits: 50 agents, 20 approved tokens, 50 destinations, 2,000 evaluations per wallet. The evaluation limit prevents further evaluations without deleting prior records. JSON export is available; server-side archival remains unsupported.

## Security and execution boundaries

Agent registration and policy ALLOW decisions grant no wallet permissions. Decisions validate submitted intent fields; they do not simulate EVM calls, obtain swap quotes, verify actual market slippage, or enforce rules against transactions submitted elsewhere.

No transaction submission, swap execution, contract deployment, arbitrary calldata handling, private-key custody, or token-approval feature is implemented. Consequently, no transaction hashes or invented onchain records are generated. Smart-contract wallet signatures are not supported in the initial EOA login flow.

State mutations use wallet-scoped keys and atomic revision checks. Concurrent stale writes return HTTP 409. Request bodies are bounded to 32 KiB. RPC and storage failures return sanitized messages. Redis access is never available directly to the browser.

Network configuration follows [Robinhood's official connection documentation](https://docs.robinhood.com/chain/connecting/): chain ID 4663, ETH gas, [Blockscout explorer](https://robinhoodchain.blockscout.com).
