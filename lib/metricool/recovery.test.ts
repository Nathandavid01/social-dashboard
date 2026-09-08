import { describe, expect, it } from 'vitest'
import { verifyRecoveryPost } from './recovery'
const expected={postId:12,caption:'Approved caption',mediaUrl:'https://media.example/edited/final.mp4',platforms:['instagram']}
const post={id:12,text:'Approved caption',draft:false,autoPublish:true,publicationDate:{dateTime:'2026-09-10T10:00:00',timezone:'America/Puerto_Rico'},providers:[{network:'instagram',id:'ig',status:'PENDING'}],media:[{url:expected.mediaUrl}],uuid:'u'}
describe('Metricool recovery evidence',()=>{
 it('accepts the exact approved media and caption on the requested networks',()=>expect(verifyRecoveryPost(post,expected)).toBeNull())
 it.each([{id:13},{text:'other'},{draft:true},{autoPublish:false},{media:['https://media.example/edited/other.mp4']},{providers:[{network:'facebook',id:'fb',status:'PENDING'}]},{media:[]}])('rejects mismatched evidence %j',change=>expect(verifyRecoveryPost({...post,...change},expected)).toBeTruthy())
 it('does not match a video URL embedded in arbitrary metadata',()=>expect(verifyRecoveryPost({...post,media:[{thumbnail:expected.mediaUrl}]},expected)).toBeTruthy())
})
