import copy,json,unittest
from pathlib import Path
from motionkit import validate,cues,ease
class MotionTests(unittest.TestCase):
 def setUp(self):self.c=json.loads(Path('motion/arecibo-clock.json').read_text())
 def test_audio_stays_inside_graphic(self):
  es=cues(validate(self.c));self.assertEqual(len(es),7)
  self.assertTrue(all(e['time']+e['duration']<=self.c['duration'] for e in es))
  self.assertEqual([e['preset'] for e in es[:3]],['clock_tick','clock_tock','clock_tick'])
 def test_invalid_geometry_and_timing(self):
  for k,v in [('radius',700),('duration',float('nan')),('tick_interval',0),('change_at',3),('values',[15,90])]:
   c=copy.deepcopy(self.c);c[k]=v
   with self.assertRaises(ValueError):validate(c)
 def test_easing_monotonic_and_clamped(self):
  a=[ease(i/100) for i in range(-10,111)]
  self.assertEqual(a,sorted(a));self.assertEqual((a[0],a[-1]),(0,1))
if __name__=='__main__':unittest.main()
