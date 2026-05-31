'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const KEY = 'nm-sidebar-collapsed'

interface SidebarContextValue {
  collapsed: boolean
  toggle: () => void
  setCollapsed: (v: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
  setCollapsed: () => {},
})

function persist(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? '1' : '0')
  } catch {
    /* ignore (SSR / disabled storage) */
  }
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false)

  // Read persisted preference after mount (avoids hydration mismatch).
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === '1') setCollapsedState(true)
    } catch {
      /* ignore */
    }
  }, [])

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v)
    persist(v)
  }, [])

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev
      persist(next)
      return next
    })
  }, [])

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}
