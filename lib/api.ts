import {ZodError} from 'zod';
import {Conflict} from './store';
import {ApiError} from './errors';
export function failure(e:unknown){
 if(e instanceof ZodError)return Response.json({error:e.issues.map(i=>i.message).join(' ')},{status:400});
 if(e instanceof Conflict)return Response.json({error:e.message},{status:409});
 if(e instanceof ApiError)return Response.json({error:e.message},{status:e.status});
 if(e instanceof SyntaxError)return Response.json({error:'Request body must be valid JSON.'},{status:400});
 return Response.json({error:'The request could not be completed. Please retry.'},{status:500});
}
export async function readBody(request:Request){
 const reader=request.body?.getReader();if(!reader)throw new ApiError('JSON body required.');
 let size=0;const chunks:Uint8Array[]=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();throw new ApiError('Request is too large.',413);}chunks.push(value);}
 return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
