import {it,expect} from 'vitest'
import {publicationState,buildCoverage} from './operational-publications'
const post=(over:any={})=>({id:1,publicationDate:{dateTime:'2026-09-08T10:00:00'},autoPublish:true,draft:false,providers:[{network:'instagram',status:'PUBLISHED',publicUrl:'https://instagram.com/p/example'}],...over})
it('requires every target network published and never counts drafts',()=>{expect(publicationState(post())).toBe('published');expect(publicationState(post({draft:true}))).toBe('draft');expect(publicationState(post({providers:[{status:'PUBLISHED'},{status:'PENDING'}]}))).toBe('partial')})
it('a past pending post is not published and a missing required day is a gap',()=>{const r=buildCoverage([post({providers:[{status:'PENDING'}]})],[2],[], '2026-09-08','2026-09-08','2026-09-15');expect(r.days[0].published).toBe(0);expect(r.days[0].covered).toBe(false);expect(r.days[1].covered).toBe(false)})
it('counts a UTC post against its actual Puerto Rico day',()=>{
 const p=post({publicationDate:{dateTime:'2026-09-09T01:00:00Z',timezone:'UTC'}})
 const r=buildCoverage([p],[2],[], '2026-09-08','2026-09-08','2026-09-09')
 expect(r.days.find(d=>d.date==='2026-09-08')?.published).toBe(1)
 expect(r.days.find(d=>d.date==='2026-09-08')?.covered).toBe(true)
 expect(r.days.find(d=>d.date==='2026-09-09')).toBeUndefined()
})
it.each(['ERROR','PENDING'])('does not label an off-cadence %s post as covered today',status=>{
 const r=buildCoverage([post({providers:[{network:'instagram',status}]})],[],[], '2026-09-08','2026-09-08','2026-09-08')
 expect(r.days[0].expected).toBe(1)
 expect(r.days[0].covered).toBe(false)
})
it('marks invalid remote dates as unverified instead of concluding missing publication',()=>{
 const r=buildCoverage([post({publicationDate:{dateTime:'bad',timezone:'Invalid/Zone'}})],[2],[], '2026-09-08','2026-09-08','2026-09-08')
 expect(r).toHaveProperty('error',expect.stringContaining('Fechas Sin Verificar'))
})
