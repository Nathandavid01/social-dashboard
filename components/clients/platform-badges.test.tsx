import {it,expect} from 'vitest'
import {render,screen,cleanup} from '@testing-library/react'
import {PlatformBadges} from './platform-badges'
it('opens supplied social profiles in a new tab',()=>{render(<PlatformBadges platforms={['instagram','facebook']} links={{instagram:'https://www.instagram.com/example/'}}/>);const a=screen.getByRole('link',{name:'Instagram'});expect(a).toHaveAttribute('href','https://www.instagram.com/example/');expect(a).toHaveAttribute('target','_blank');expect(screen.queryByRole('link',{name:'Facebook'})).toBeNull();cleanup()})
