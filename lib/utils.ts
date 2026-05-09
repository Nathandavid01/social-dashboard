import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import type { SocialPlatform, ClientStatus, TaskStatus, AlertSeverity } from './supabase/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), 'MMM d, yyyy h:mm a')
}

export function formatTime(date: string | Date) {
  return format(new Date(date), 'h:mm a')
}

export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export const platformColors: Record<SocialPlatform, string> = {
  instagram: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  facebook: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  tiktok: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  linkedin: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
}

export const platformLabels: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
}

export const statusColors: Record<ClientStatus, string> = {
  active: 'bg-green-500/10 text-green-500 border-green-500/20',
  paused: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  onboarding: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
}

export const taskStatusColors: Record<TaskStatus, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  in_progress: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  completed: 'bg-green-500/10 text-green-500 border-green-500/20',
  blocked: 'bg-red-500/10 text-red-500 border-red-500/20',
}

export const alertSeverityColors: Record<AlertSeverity, string> = {
  info: 'border-l-blue-500 bg-blue-500/5',
  warning: 'border-l-yellow-500 bg-yellow-500/5',
  error: 'border-l-red-500 bg-red-500/5',
  success: 'border-l-green-500 bg-green-500/5',
}

export const alertSeverityTextColors: Record<AlertSeverity, string> = {
  info: 'text-blue-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
  success: 'text-green-500',
}
