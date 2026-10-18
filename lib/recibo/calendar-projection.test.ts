import { describe, it, expect } from 'vitest'
import { calendarWeekStart, projectReciboVideos } from './calendar-projection'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
const idea = (id: string, extra = {}) => ({ id, client_id: 'c', title: id, status: 'producida', created_at: id, videos: [{ id: `v${id}`, kind: 'edited', name: `${id}.mp4`, mime_type: 'video/mp4', status: 'uploaded', storage_provider: 'entregas-r2', drive_file_id: id }], ...extra } as unknown as IdeaWithPipeline)
// Eric changed the contract on 2026-10-18: graphics join calendar coverage; video safeguards remain.
const graphic = (id: string) => idea(id, { videos: [{ ...idea(id).videos![0], name: `${id}.png`, mime_type: 'image/png' }] })
describe('Recibo video coverage', () => {
 it('starts the calendar on the current week, including month boundaries', () => {
  expect(calendarWeekStart('2026-10-16')).toBe('2026-10-11')
  expect(calendarWeekStart('2026-11-01')).toBe('2026-11-01')
 })
 it('projects eight distinct cuts after occupied dates without treating pending approval as scheduled', () => {
  const rows=Array.from({length:8},(_,i)=>idea(String(i)))
  const result=projectReciboVideos([...rows,rows[0],idea('published',{manual_posted_status:'posted'}),idea('scheduled',{metricool_post_id:123})], '2026-10-16',[0,1,2,3,4,5,6],['2026-10-16','2026-10-17'])
  expect(result.total).toBe(8);expect(result.posts[0].date).toBe('2026-10-18');expect(result.through).toBe('2026-10-25')
 })
 it('skips a slot whose configured time has passed',()=>{expect(projectReciboVideos([idea('1')],'2026-10-16',[5,6],[],{},'11:00','20:00').through).toBe('2026-10-17')})
 it('does not invent cadence and skips post-only days',()=>{
  expect(projectReciboVideos([idea('1')],'2026-10-16',[],[]).through).toBeNull()
  expect(projectReciboVideos([idea('1')],'2026-10-16',[5,6],[],{'5':'post','6':'reel'}).through).toBe('2026-10-17')
 })
})

it('assigns graphics to Post and videos to Reel without blocking the other format', () => {
 const result = projectReciboVideos([idea('1'), graphic('2'), graphic('3')], '2026-10-16', [5,6,0], [], {'5':'post','6':'reel','0':'story'})
 expect(result.posts.map(p => [p.idea.id,p.date,p.image])).toEqual([['2','2026-10-16',true],['1','2026-10-17',false],['3','2026-10-23',true]])
})
it('keeps seven unscheduled graphics visible without inventing a cadence', () => {
 const rows = Array.from({length:7},(_,i)=>graphic(String(i)))
 const result = projectReciboVideos([...rows, rows[0], {...graphic('published'),metricool_post_id:123}], '2026-10-16', [], [])
 expect(result.total).toBe(7)
 expect(result.posts).toEqual([])
 expect(result.unplaced.map(p=>p.idea.id)).toEqual(rows.map(p=>p.id))
})
it('shares unspecified slots fairly by received order and respects occupancy for both formats', () => {
 const result=projectReciboVideos([graphic('1'),idea('2'),graphic('3')], '2026-10-16',[5,6,0],['2026-10-16'])
 expect(result.posts.map(p=>p.idea.id)).toEqual(['1','2','3'])
 expect(result.posts[0].date).toBe('2026-10-17')
})
