import {cookies} from 'next/headers';
import {verifyMessage} from 'viem';
import {z} from 'zod';
import {assertOrigin,authMessage,COOKIE,digest,requireWallet,secret} from '@/lib/auth';
import {get,set,take,rateLimit} from '@/lib/store';
import {addressSchema} from '@/lib/model';
import {failure,readBody} from '@/lib/api';
import {ApiError} from '@/lib/errors';
export const runtime='nodejs';
type Challenge={wallet:string;message:string;nonce:string};
export async function GET(){try{return Response.json({wallet:await requireWallet()},{headers:{'Cache-Control':'no-store'}});}catch(e){if(e instanceof ApiError && e.status===401)return Response.json({wallet:null},{headers:{'Cache-Control':'no-store'}});return failure(e);}}
export async function POST(req:Request,{params}:{params:Promise<{action:string}>}){try{assertOrigin(req);const {action}=await params;
 if(action==='logout'){const jar=await cookies();const token=jar.get(COOKIE)?.value;if(token)await take('session:'+digest(token));jar.delete(COOKIE);return Response.json({ok:true});}
 if(action==='challenge'){const {wallet}=z.object({wallet:addressSchema}).strict().parse(await readBody(req));await rateLimit('challenge:'+wallet,10);const nonce=secret();const origin=process.env.APP_ORIGIN||new URL(req.url).origin;const message=authMessage(origin,wallet,nonce,new Date().toISOString());await set('challenge:'+nonce,{wallet,message,nonce},300);return Response.json({nonce,message},{headers:{'Cache-Control':'no-store'}});}
 if(action==='verify'){const {nonce,signature}=z.object({nonce:z.string().regex(/^[a-f0-9]{64}$/),signature:z.string().regex(/^0x[0-9a-fA-F]+$/).max(2048)}).strict().parse(await readBody(req));const challenge=await take<Challenge>('challenge:'+nonce);if(!challenge)throw new ApiError('Sign in request expired or was already used.',401);let valid=false;try{valid=await verifyMessage({address:challenge.wallet as `0x${string}`,message:challenge.message,signature:signature as `0x${string}`});}catch{}if(!valid)throw new ApiError('Invalid wallet signature.',401);const token=secret();await set('session:'+digest(token),{wallet:challenge.wallet},3600*12);(await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:3600*12});return Response.json({wallet:challenge.wallet},{headers:{'Cache-Control':'no-store'}});}
 return Response.json({error:'Unknown action.'},{status:404});
 }catch(e){return failure(e);}}
