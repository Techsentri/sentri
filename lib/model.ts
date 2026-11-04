import { z } from 'zod';
import { isAddress, parseUnits } from 'viem';
export const CHAIN_ID = 4663;
export const EXPLORER = 'https://robinhoodchain.blockscout.com';
export const addressSchema = z.string().refine(v => isAddress(v, {strict:true}), 'Enter a valid EVM address.').transform(v=>v.toLowerCase());
export const decimalSchema = z.string().regex(/^(0|[1-9]\d{0,29})(\.\d{1,18})?$/, 'Use a positive decimal with at most 18 decimal places.');
export const agentInput = z.object({name:z.string().trim().min(2).max(60),description:z.string().trim().max(300),canEvaluate:z.boolean()});
export type Agent = z.infer<typeof agentInput> & {id:string;wallet:string;active:boolean;createdAt:string};
export type Token = {address:string;symbol:string;decimals:number};
export type Policy = {version:number;maxAmount:string;maxSlippageBps:number;tokens:Token[];contracts:string[];authorization:boolean;updatedAt:string};
export const policyInput = z.object({expectedVersion:z.number().int().min(1),maxAmount:decimalSchema.refine(v=>Number(v)>0,'Limit must be greater than zero.'),maxSlippageBps:z.number().int().min(0).max(10000),tokenAddresses:z.array(z.union([z.literal('native'),addressSchema])).min(1).max(20),contracts:z.array(addressSchema).max(50),authorization:z.boolean()});
export const intentInput = z.object({agentId:z.string().uuid(),token:z.union([z.literal('native'),addressSchema]),destination:addressSchema,amount:decimalSchema.refine(v=>Number(v)>0,'Amount must be greater than zero.'),slippageBps:z.number().int().min(0).max(10000),chainId:z.number().int().positive()});
export type Intent = z.infer<typeof intentInput>;
export type Rule = {name:string;pass:boolean;detail:string};
export type Evaluation = {id:string;timestamp:string;wallet:string;chainId:number;agentId:string;agentName:string;policyVersion:number;policySnapshot:Policy;decision:'ALLOW'|'REJECT';rules:Rule[];intent:Intent;kind:'policy-evaluation'};
export type Workspace = {revision:number;agents:Agent[];policy:Policy;history:Evaluation[]};
export function initialWorkspace(): Workspace { return {revision:0,agents:[],policy:{version:1,maxAmount:'1',maxSlippageBps:50,tokens:[{address:'native',symbol:'ETH',decimals:18}],contracts:[],authorization:false,updatedAt:new Date().toISOString()},history:[]}; }
export function evaluate(intent:Intent, state:Workspace, wallet:string, id=crypto.randomUUID(), timestamp=new Date().toISOString()):Evaluation {
 const p=state.policy, agent=state.agents.find(a=>a.id===intent.agentId && a.wallet===wallet), token=p.tokens.find(t=>t.address===intent.token);
 let amountPass=false; let amountDetail='Token is not approved; amount cannot be evaluated.';
 if(token){try{const amount=parseUnits(intent.amount,token.decimals),limit=parseUnits(p.maxAmount,token.decimals);const precision=(intent.amount.split('.')[1]?.length??0)<=token.decimals;amountPass=precision&&amount>0n&&amount<=limit;amountDetail=precision?`${intent.amount} ${token.symbol} / maximum ${p.maxAmount} ${token.symbol}`:`Amount exceeds ${token.decimals} token decimals.`;}catch{amountDetail='Amount cannot be represented safely.';}}
 const rules:Rule[]=[{name:'Network',pass:intent.chainId===CHAIN_ID,detail:`Requested ${intent.chainId}; required ${CHAIN_ID}.`},{name:'Agent status',pass:!!agent?.active,detail:agent?.active?'Registered agent is active.':'Agent is missing, inactive, or not owned by this wallet.'},{name:'Agent permission',pass:!!agent?.canEvaluate,detail:agent?.canEvaluate?'Policy evaluation permission granted.':'Evaluation permission is disabled.'},{name:'Authorization',pass:p.authorization,detail:p.authorization?'Policy authorization is enabled.':'Policy authorization is paused.'},{name:'Token allowlist',pass:!!token,detail:token?`${token.symbol} is approved.`:'Token is not in the policy allowlist.'},{name:'Destination allowlist',pass:p.contracts.includes(intent.destination.toLowerCase()),detail:p.contracts.includes(intent.destination.toLowerCase())?'Destination is approved.':'Destination is not in the policy allowlist.'},{name:'Amount limit',pass:amountPass,detail:amountDetail},{name:'Slippage limit',pass:intent.slippageBps<=p.maxSlippageBps,detail:`${intent.slippageBps/100}% expected / ${p.maxSlippageBps/100}% maximum.`}];
 return {id,timestamp,wallet,chainId:intent.chainId,agentId:intent.agentId,agentName:agent?.name??'Unknown agent',policyVersion:p.version,policySnapshot:structuredClone(p),decision:rules.every(r=>r.pass)?'ALLOW':'REJECT',rules,intent,kind:'policy-evaluation'};
}
