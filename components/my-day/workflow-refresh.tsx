'use client'
import {useEffect} from 'react'
import {useRouter} from 'next/navigation'
export function WorkflowRefresh(){const router=useRouter();useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible')router.refresh()},60000);return()=>clearInterval(timer)},[router]);return null}
