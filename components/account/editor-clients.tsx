import {getMyEditorClients} from '@/lib/actions/recording-editors'
export async function EditorClients({memberId}:{memberId?:string}){
 const result=await getMyEditorClients(memberId)
 return <section className="rounded-xl border p-4"><h2 className="text-lg font-semibold">Clientes Vinculados</h2>{result.error&&<p role="alert" className="mt-3 text-sm text-amber-600">{result.error}</p>}<div className="mt-3 flex flex-wrap gap-2">{result.clients.map(c=><span key={c.id} className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-sm">{c.name}</span>)}</div>{!result.error&&!result.clients.length&&<p className="mt-2 text-sm text-muted-foreground">No Tienes Clientes Vinculados.</p>}</section>
}
