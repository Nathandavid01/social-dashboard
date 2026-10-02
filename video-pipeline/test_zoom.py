import unittest
from pipeline import zoom_filter
class ZoomTests(unittest.TestCase):
 def test_both_directions_use_local_frame_count(self):
  for start,end in [(1,1.1),(1.1,1)]:
   f=zoom_filter({'in':4,'out':5.5,'zoom_keyframes':[{'time':0,'zoom':start},{'time':1.5,'zoom':end}]})
   self.assertIn('on/44',f)
   self.assertIn(f'({end}-{start})',f)
   self.assertIn(':d=1:',f)
 def test_rejects_excessive_zoom(self):
  with self.assertRaises(ValueError):zoom_filter({'in':0,'out':1,'zoom_keyframes':[{'time':0,'zoom':1},{'time':1,'zoom':2}]})
 def test_rejects_keyframes_outside_shot(self):
  with self.assertRaises(ValueError):zoom_filter({'in':0,'out':1,'zoom_keyframes':[{'time':0,'zoom':1},{'time':2,'zoom':1.1}]})
