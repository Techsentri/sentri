import 'server-only';
import {cookies} from 'next/headers';
import {createHash,randomBytes} from 'node:crypto';
import {get} from './store';
import {ApiError} from './errors';
export const COOKIE='sentri_session';
export const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
export const secret=()=>randomBytes(32).toString('hex');
export function assertOrigin(request:Request){const origin=request.headers.get('origin');const expected=process.env.APP_ORIGIN || new URL(request.url).origin;if(!origin || origin!==expected)throw new ApiError('Origin not authorized.',403);}
export async function requireWallet(){const token=(await cookies()).get(COOKIE)?.value;if(!token)throw new ApiError('Connect and sign in with your wallet.',401);const session=await get<{wallet:string}>('session:'+digest(token));if(!session)throw new ApiError('Session expired. Sign in again.',401);return session.wallet;}
export function authMessage(origin:string,wallet:string,nonce:string,issued:string){return `${new URL(origin).host} wants you to sign in with your Ethereum account:\n${wallet}\n\nSign in to SENTRI. This signature grants no transaction or token permissions.\n\nURI: ${origin}\nVersion: 1\nChain ID: 4663\nNonce: ${nonce}\nIssued At: ${issued}\nExpiration Time: ${new Date(new Date(issued).getTime()+300000).toISOString()}`;}
