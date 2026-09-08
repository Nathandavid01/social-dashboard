import {it,expect} from 'vitest'
import {render,screen,cleanup} from '@testing-library/react'
import {Dialog,DialogContent,DialogTitle} from './dialog'
it('separates the recording surface from a blurred backdrop',()=>{
 render(<Dialog open><DialogContent surface="raised"><DialogTitle>Sesión</DialogTitle></DialogContent></Dialog>)
 expect(screen.getByRole('dialog')).toHaveClass('dark:bg-slate-900','rounded-2xl')
 expect(document.querySelector('[data-slot="dialog-overlay"]')).toHaveClass('backdrop-blur-sm')
 cleanup()
})
