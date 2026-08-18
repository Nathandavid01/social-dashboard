'use client'

import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

export function ThemeToggleMenuItem() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme !== 'light'

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      onSelect={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
      {isDark ? 'Tema claro' : 'Tema oscuro'}
    </DropdownMenuItem>
  )
}
