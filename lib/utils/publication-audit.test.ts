import {describe,it,expect} from 'vitest'
import { summarizePublicationWindow } from './publication-audit'
describe('publication window',()=>{
 it('counts drafts as blocked even with autoPublish enabled, and ignores dates outside the window',()=>{
  const result=summarizePublicationWindow([
   {publicationDate:{dateTime:'2026-09-08T08:30:00'},draft:true,autoPublish:true,providers:[{status:'PENDING'}]},
   {publicationDate:{dateTime:'2026-09-09T10:00:00'},draft:false,autoPublish:true,providers:[{status:'PENDING'}]},
   {publicationDate:{dateTime:'2026-08-01T10:00:00'},draft:false,autoPublish:true,providers:[{status:'PUBLISHED'}]},
  ],'2026-09-08','2026-09-21')
  expect(result).toEqual({drafts:1,scheduled:1,failed:0,manual:0,published:0})
 })
 it('does not call a post ready when there are no target networks or autoPublish is off',()=>{
  expect(summarizePublicationWindow([{publicationDate:{dateTime:'2026-09-08T10:00:00'},draft:false,autoPublish:false,providers:[{status:'PENDING'}]},{publicationDate:{dateTime:'2026-09-08T10:00:00'},draft:false,autoPublish:true,providers:[]}],'2026-09-08','2026-09-21').manual).toBe(2)
 })
})
