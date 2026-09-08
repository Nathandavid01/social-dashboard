import type { ScheduledPost } from '@/lib/metricool/scheduler'
export function publicationState(p:ScheduledPost) {
 if(p.draft)return 'draft'
 if(p.providers?.some(n=>n.status==='ERROR'))return 'failed'
 if(p.providers?.length&&p.providers.every(n=>n.status==='PUBLISHED'))return 'published'
 if(p.providers?.some(n=>n.status==='PUBLISHED'))return 'partial'
 if(p.autoPublish&&p.providers?.length&&p.providers.every(n=>n.status==='PENDING'))return 'scheduled'
 return 'unknown'
}
export interface AuditIdea {id:string;title:string;publish_date:string|null;metricool_post_id:number|null}
export function buildCoverage(posts:ScheduledPost[], postingDays:number[], ideas:AuditIdea[], today:string, start:string, end:string) {
 const days=[]
 for(let d=new Date(start+'T12:00:00Z');d.toISOString().slice(0,10)<=end;d.setUTCDate(d.getUTCDate()+1)) {
  const date=d.toISOString().slice(0,10)
  const planned=ideas.filter(i=>i.publish_date===date)
  const scheduled=posts.filter(p=>p.publicationDate?.dateTime?.slice(0,10)===date)
  if(!postingDays.includes(d.getUTCDay())&&!planned.length&&!scheduled.length)continue
  const expected=Math.max(postingDays.includes(d.getUTCDay())?1:0,planned.length)
  const published=scheduled.filter(p=>publicationState(p)==='published').length
  const ready=scheduled.filter(p=>['scheduled','published'].includes(publicationState(p))).length
  // Today's completion is publication; future coverage may be scheduled.
  const matched=planned.every(i=>{const p=scheduled.find(p=>String(p.id)===String(i.metricool_post_id));return p && (date>today?['scheduled','published'].includes(publicationState(p)):publicationState(p)==='published')})
  days.push({date,expected,published,ready,covered:(date>today?ready:published)>=expected&&matched,
   videos:planned.map(i=>{const p=posts.find(p=>String(p.id)===String(i.metricool_post_id));return {...i,state:p?publicationState(p):'unverified',networks:p?.providers??[]}}),
   posts:scheduled.map(p=>({id:p.id,state:publicationState(p),networks:p.providers??[]}))})
 }
 return {days,overdue:days.filter(d=>d.date<today&&!d.covered).length,futureRequired:days.filter(d=>d.date>today&&d.expected>0).length,futureCovered:days.filter(d=>d.date>today&&d.expected>0&&d.covered).length,nextGap:days.find(d=>d.date>today&&d.expected>0&&!d.covered)?.date??null}
}
export type ClientCoverage = ReturnType<typeof buildCoverage> & {id:string;name:string;error?:string}
export interface OperationalPublicationReport {today:string;start:string;end:string;checkedAt:string;clients:ClientCoverage[]}
