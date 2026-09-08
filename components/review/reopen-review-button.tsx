'use client'
import {useState,useTransition} from 'react'
import {useRouter} from 'next/navigation'
import {reopenReviewForVerification} from '@/lib/actions/pipeline-submit'
export function ReopenReviewButton({ideaId}:{ideaId:string}){
 const [pending,start]=useTransition(),[error,setError]=useState(''),router=useRouter()
 return <div className="mt-3"><button disabled={pending} onClick={()=>start(async()=>{const r=await reopenReviewForVerification(ideaId);if(r.error)setError(r.error);else{router.push('/revision');router.refresh()}})} className="min-h-10 rounded-lg border border-violet-500/40 px-3 text-xs text-violet-600 dark:text-violet-300">{pending?'Abriendo…':'Volver A Revisión'}</button>{error&&<p role="alert" className="mt-2 text-xs text-rose-500">{error}</p>}</div>
}
