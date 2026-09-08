import {it,expect} from 'vitest'
import {metricoolProfileLinks} from './metricool-profile-links'
it('uses provider identifiers, never the client display name',()=>{expect(metricoolProfileLinks({instagram:'arasibosteakhouseboutique',facebook:'1594755110757030',tiktok:'arasibosteakhouse'})).toEqual({instagram:'https://www.instagram.com/arasibosteakhouseboutique/',facebook:'https://www.facebook.com/1594755110757030',tiktok:'https://www.tiktok.com/@arasibosteakhouse'})})
it('does not invent profiles or accept unsafe URLs',()=>{expect(metricoolProfileLinks({label:'A Client',instagram:true,facebook:'javascript:alert(1)',tiktok:'https://evil.example/x'})).toEqual({})})
it('accepts a verified network URL',()=>{expect(metricoolProfileLinks({instagram:'https://www.instagram.com/example/'}).instagram).toBe('https://www.instagram.com/example/')})
