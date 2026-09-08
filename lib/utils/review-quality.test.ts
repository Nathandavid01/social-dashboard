import {it,expect} from 'vitest'
import {reviewQualityError} from './review-quality'
it('requires the exact watched file and captions verification',()=>{
 expect(reviewQualityError({decision:'approve'})).toBeTruthy()
 expect(reviewQualityError({decision:'approve',videoFileId:'v',captionsVerified:true,videoVerified:true})).toBeNull()
})
it('a correction note cannot be approved',()=>{expect(reviewQualityError({decision:'approve',note:'Fix typo',videoFileId:'v',captionsVerified:true,videoVerified:true})).toContain('Devuelve')})
it('requires actionable feedback on corrections',()=>{expect(reviewQualityError({decision:'request_changes',note:' '})).toBeTruthy();expect(reviewQualityError({decision:'request_changes',note:'Corrige el subtítulo en 00:12'})).toBeNull()})
