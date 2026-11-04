'use client';
import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Plus, Pencil, Power, Check, X } from 'lucide-react';
import { Gate } from '@/components/chrome';
import { useSentri, shortAddress } from '@/components/provider';
import { Empty, Feedback, ProductHeading, Submit } from '@/components/product';
import { agentInput, type Agent } from '@/lib/model';

function AgentForm({ agent, cancel }: { agent?: Agent; cancel?: () => void }) {
  const { mutate } = useSentri();
  const [name, setName] = useState(agent?.name ?? ''); const [description, setDescription] = useState(agent?.description ?? '');
  const [permission, setPermission] = useState(agent?.canEvaluate ?? true);
  const [pending, setPending] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSuccess(''); setPending(true);
    try {
      const parsed = agentInput.safeParse({ name, description, canEvaluate: permission });
      if (!parsed.success) throw new Error(parsed.error.issues.map(i => i.message).join(' '));
      await mutate(agent ? 'updateAgent' : 'register', agent ? { ...parsed.data, id: agent.id } : parsed.data);
      if (agent) cancel?.(); else { setName(''); setDescription(''); setSuccess('Agent registered to your signed-in wallet.'); }
    } catch (e) { setError((e as Error).message); } finally { setPending(false); }
  }
  return <form className="editor-form" onSubmit={submit}><div className="section-label"><span>{agent ? 'EDIT AGENT' : 'REGISTER AN AGENT'}</span>{agent ? <Pencil size={15} /> : <Plus size={17} />}</div><label>Agent name<input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={60} placeholder="Name your agent" autoComplete="off" /></label><label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={300} rows={3} placeholder="Describe this agent’s role" /></label><label className="check-field"><input type="checkbox" checked={permission} onChange={e => setPermission(e.target.checked)} /><span>Permit policy evaluations<small>Allow this agent to request policy decisions.</small></span></label><Feedback error={error} success={success} /><div className="form-actions"><Submit pending={pending}>{agent ? 'Save agent' : 'Register agent'}<ArrowUpRight size={17} /></Submit>{agent && <button type="button" className="button ghost" disabled={pending} onClick={cancel}>Cancel</button>}</div><p className="fine-print">Registration does not grant independent wallet access or onchain permissions.</p></form>;
}
function Registry() {
  const { workspace, mutate } = useSentri(); const [editing, setEditing] = useState<string | null>(null); const [pending, setPending] = useState<string | null>(null); const [error, setError] = useState('');
  const agents = workspace!.agents;
  async function toggle(id: string) { setPending(id); setError(''); try { await mutate('toggle', { id }); } catch (e) { setError((e as Error).message); } finally { setPending(null); } }
  return <div className="split-workspace registry-layout"><section><div className="section-label"><span>YOUR REGISTERED AGENTS</span><span>{String(agents.length).padStart(2, '0')} / 50</span></div><Feedback error={error} />{agents.length ? <div className="agent-list">{agents.map(agent => <article className="agent-entry" key={agent.id}>{editing === agent.id ? <AgentForm agent={agent} cancel={() => setEditing(null)} /> : <><div className="agent-top"><div className={`agent-symbol ${agent.active ? '' : 'inactive'}`} aria-hidden="true">↗</div><span className={`status-tag ${agent.active ? 'green' : ''}`}>{agent.active ? 'ACTIVE' : 'INACTIVE'}</span></div><h2>{agent.name}</h2><p className="agent-description">{agent.description || 'No description provided.'}</p><div className="agent-meta"><code title={agent.wallet}>{shortAddress(agent.wallet)}</code><span>{agent.canEvaluate ? <Check size={12} /> : <X size={12} />}Evaluations {agent.canEvaluate ? 'permitted' : 'disabled'}</span></div><code className="agent-id">{agent.id}</code><div className="entry-actions"><button disabled={pending !== null} onClick={() => setEditing(agent.id)}><Pencil size={14} /> Edit</button><button disabled={pending !== null} onClick={() => toggle(agent.id)}><Power size={14} />{pending === agent.id ? 'Updating…' : agent.active ? 'Deactivate' : 'Activate'}</button></div></>}</article>)}</div> : <Empty title="No agents registered.">Your agents appear here after registration. Start with a name and a role.</Empty>}</section><aside><AgentForm /></aside></div>;
}
export function AgentsScreen() { return <main id="main" className="product-page"><ProductHeading index="01" label="AGENT REGISTRY" title="Know your agents." description="Give every autonomous actor an identity. Keep every permission intentional." /><Gate><Registry /></Gate></main>; }
