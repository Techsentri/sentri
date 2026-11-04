import { randomUUID } from 'node:crypto';
import { createPublicClient, http, erc20Abi, zeroAddress } from 'viem';
import { z } from 'zod';
import { assertOrigin, requireWallet } from '@/lib/auth';
import { get, compareSet, rateLimit, Conflict } from '@/lib/store';
import { agentInput, policyInput, intentInput, initialWorkspace, evaluate, type Workspace, type Token } from '@/lib/model';
import { failure, readBody } from '@/lib/api';
import { ApiError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const envelope = z.object({ action: z.enum(['register', 'updateAgent', 'toggle', 'policy', 'evaluate']), data: z.unknown() }).strict();

export async function GET() {
  try {
    const wallet = await requireWallet();
    return Response.json(await get<Workspace>('wallet:' + wallet) ?? initialWorkspace(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return failure(e); }
}

export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const wallet = await requireWallet();
    await rateLimit('mutate:' + wallet, 60);
    const body = envelope.parse(await readBody(req));
    const state = await get<Workspace>('wallet:' + wallet) ?? initialWorkspace();
    const revision = state.revision;

    if (body.action === 'register') {
      const data = agentInput.strict().parse(body.data);
      if (state.agents.length >= 50) throw new ApiError('Agent limit reached (50).');
      state.agents.push({ ...data, id: randomUUID(), wallet, active: true, createdAt: new Date().toISOString() });
    } else if (body.action === 'toggle' || body.action === 'updateAgent') {
      const { id } = z.object({ id: z.string().uuid() }).parse(body.data);
      const agent = state.agents.find(a => a.id === id && a.wallet === wallet);
      if (!agent) throw new ApiError('Agent not found for this wallet.', 404);
      if (body.action === 'toggle') agent.active = !agent.active;
      else Object.assign(agent, agentInput.extend({ id: z.string().uuid() }).strict().parse(body.data));
    } else if (body.action === 'policy') {
      const p = policyInput.strict().parse(body.data);
      if (p.expectedVersion !== state.policy.version) throw new Conflict('Policy version changed. Refresh before saving.');
      const tokens: Token[] = [];
      const client = createPublicClient({ transport: http(process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com', { timeout: 8000, retryCount: 0 }) });
      for (const address of [...new Set(p.tokenAddresses)]) {
        if (address === 'native') { tokens.push({ address, symbol: 'ETH', decimals: 18 }); continue; }
        if (address === zeroAddress) throw new ApiError('Zero address cannot be a token.');
        try {
          if (await client.getChainId() !== 4663) throw new Error();
          const [decimals, symbol] = await Promise.all([
            client.readContract({ address: address as `0x${string}`, abi: erc20Abi, functionName: 'decimals' }),
            client.readContract({ address: address as `0x${string}`, abi: erc20Abi, functionName: 'symbol' }),
          ]);
          if (decimals > 18) throw new ApiError('Token precision above 18 is unsupported.');
          if ((p.maxAmount.split('.')[1]?.length ?? 0) > decimals) throw new ApiError('Policy amount exceeds token precision.');
          tokens.push({ address, decimals, symbol: symbol.slice(0, 16) });
        } catch (e) {
          if (e instanceof ApiError) throw e;
          throw new ApiError('Could not verify token metadata on Robinhood Chain. Use a valid ERC-20 address or native ETH.', 422);
        }
      }
      state.policy = { version: state.policy.version + 1, maxAmount: p.maxAmount, maxSlippageBps: p.maxSlippageBps, tokens, contracts: [...new Set(p.contracts)], authorization: p.authorization, updatedAt: new Date().toISOString() };
    } else {
      const intent = intentInput.strict().parse(body.data);
      if (state.history.length >= 2000) throw new ApiError('Audit retention limit reached (2,000 evaluations).');
      state.history.unshift(evaluate(intent, state, wallet));
    }

    state.revision++;
    await compareSet('wallet:' + wallet, revision, state);
    return Response.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return failure(e); }
}
