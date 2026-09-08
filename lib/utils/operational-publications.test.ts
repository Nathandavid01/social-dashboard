import {it,expect} from 'vitest'
import {publicationState,buildCoverage} from './operational-publications'
const post=(over:any={})=>({id:1,publicationDate:{dateTime:'2026-09-08T10:00:00'},autoPublish:true,draft:false,providers:[{network:'instagram',status:'PUBLISHED',publicUrl:'https://instagram.com/p/example'}],...over})
it('requires every target network published and never counts drafts',()=>{expect(publicationState(post())).toBe('published');expect(publicationState(post({draft:true}))).toBe('draft');expect(publicationState(post({providers:[{status:'PUBLISHED'},{status:'PENDING'}]}))).toBe('partial')})
it('a past pending post is not published and a missing required day is a gap',()=>{const r=buildCoverage([post({providers:[{status:'PENDING'}]})],[2],[], '2026-09-08','2026-09-08','2026-09-15');expect(r.days[0].published).toBe(0);expect(r.days[0].covered).toBe(false);expect(r.days[1].covered).toBe(false)})
