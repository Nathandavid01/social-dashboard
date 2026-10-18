import { describe, expect, it } from 'vitest'
import { buildCalendarCoverage, calendarCoverageDuration } from './calendar-coverage'
import type { PublishedPost } from '@/app/api/metricool/posts/route'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
const idea = { id:'i', client_id:'c', status:'producida', videos:[{id:'v',kind:'edited',status:'uploaded',name:'pizza.png',storage_provider:'entregas-r2',drive_file_id:'f'}] } as IdeaWithPipeline
const client = {id:'c',metricool_blog_id:'1',posting_days:[1,3,5],posting_time:'10:00'}
const post = (id:number,date:string,draft=true): PublishedPost => ({id,uuid:`u${id}`,blogId:'1',clientId:'c',text:'Pizza',publicationDate:date,timezone:'America/Puerto_Rico',draft,autoPublish:!draft,media:[],platforms:['instagram'],providerStatuses:['PENDING']})
describe('calendar end date from current content',()=>{
 it('reserves drafts before assigning the remaining pending pieces',()=>{
  const result=buildCalendarCoverage([idea],client,[post(1,'2026-10-19T10:00:00')],'2026-10-18T10:00:00')
  expect(result.posts[0].date).toBe('2026-10-21')
  expect(result.through).toBe('2026-10-21')
  expect(result.drafts).toBe(1)
 })
 it('includes the last scheduled date beyond the queue and deduplicates API rows',()=>{
  const scheduled=post(1,'2027-02-10T10:00:00',false)
  const result=buildCalendarCoverage([idea],client,[scheduled,scheduled],'2026-10-18T10:00:00')
  expect(result.through).toBe('2027-02-10')
  expect(result.scheduled).toBe(1)
  expect(result.total).toBe(1)
 })
 it('retains a future end date when there is no pending content or configured cadence',()=>{
  const result=buildCalendarCoverage([],{...client,posting_days:[]},[post(1,'2026-11-04T10:00:00')],'2026-10-18T10:00:00')
  expect(result.through).toBe('2026-11-04')
  expect(result.total).toBe(0)
 })
 it('does not turn foreign, failed, unknown or past posts into available future content',()=>{
  const result=buildCalendarCoverage([],client,[post(1,'2026-10-17T10:00:00'),{...post(2,'2026-12-01T10:00:00'),clientId:'other'}, {...post(3,'2026-12-01T10:00:00'),blogId:'other'}, {...post(4,'2026-12-01T10:00:00',false),providerStatuses:['ERROR']}, {...post(5,'2026-12-01T10:00:00',false),providerStatuses:['UNKNOWN']}],'2026-10-18T10:00:00')
  expect(result.through).toBeNull()
  expect(result.drafts).toBe(0)
  expect(result.scheduled).toBe(0)
 })
 it('does not project a pending idea already linked to Metricool',()=>{
  const result=buildCalendarCoverage([{...idea,metricool_post_id:123}],client,[],'2026-10-18T10:00:00')
  expect(result.total).toBe(0)
 })
 it('does not invent compatible dates or count content beyond the one-year horizon',()=>{
  const result=buildCalendarCoverage([idea],{...client,posting_days:[]},[post(1,'2028-10-18T10:00:00')],'2026-10-18T10:00:00')
  expect(result.through).toBeNull()
  expect(result.overflow).toBe(1)
 })
})


describe('remaining content duration from Puerto Rico today', () => {
 it.each([
  ['2026-11-02', '2026-10-18', '2 semanas y 1 día más de contenido'],
  ['2026-10-25', '2026-10-18', '1 semana más de contenido'],
  ['2026-11-01', '2026-10-18', '2 semanas más de contenido'],
  ['2026-10-19', '2026-10-18', '1 día más de contenido'],
  ['2026-10-24', '2026-10-18', '6 días más de contenido'],
  ['2026-10-18', '2026-10-18', 'Contenido hasta hoy'],
  ['2026-10-17', '2026-10-18', null],
  [null, '2026-10-18', null],
  ['2026-02-30', '2026-10-18', null],
 ])('formats %s relative to %s without rounding up', (through, today, expected) => {
  expect(calendarCoverageDuration(through, today)).toBe(expected)
 })
})
