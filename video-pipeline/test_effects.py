import copy,math,unittest
from effects import SOUNDS,VISUALS,validate_event,sound_samples,layer_fade_filter
from effectkit import apply_patch
class EffectsTests(unittest.TestCase):
 def test_all_sound_presets_have_clean_edges_and_bounded_peak(self):
  for name,meta in SOUNDS.items():
   with self.subTest(name=name):
    e={'preset':name,'time':0};a=sound_samples(e)
    self.assertEqual(len(a),round(meta['duration']*48000));self.assertEqual(a[0],0);self.assertEqual(a[-1],0)
    self.assertGreater(max(map(abs,a)),100);self.assertLessEqual(max(map(abs,a)),math.ceil(32767*10**(meta['gain_db']/20)))
    self.assertEqual(a,sound_samples(e))
 def test_rejects_invalid_events(self):
  for change in [{'preset':'bad'},{'time':float('nan')},{'duration':0},{'gain_db':0},{'intensity':2},{'time':True}]:
   with self.subTest(change=change),self.assertRaises(ValueError):validate_event({'preset':'pop','time':0,**change},3)
  with self.assertRaises(ValueError):validate_event({'preset':'pop','time':2.99},3)
 def test_patch_preserves_original_and_routes_events(self):
  e={'clips':[{'in':0,'out':4}],'broll':[{'in':0,'out':2,'at':1}],'sounds':[{'kind':'click','time':0}]};original=copy.deepcopy(e)
  result=apply_patch(e,{'events':[{'preset':'mouse_click','time':1},{'preset':'dip_black','time':2}],'broll_fades':[{'index':0,'fade_in':.2,'fade_out':.2}]})
  self.assertEqual(e,original);self.assertEqual(len(result['sounds']),2);self.assertEqual(result['effects'][0]['preset'],'dip_black');self.assertEqual(result['broll'][0]['fade_in'],.2)
 def test_bad_fade_fails_without_partial_mutation(self):
  e={'clips':[{'in':0,'out':3}],'broll':[{'in':0,'out':.5,'at':0}]};original=copy.deepcopy(e)
  with self.assertRaises(ValueError):apply_patch(e,{'events':[{'preset':'pop','time':0}],'broll_fades':[{'index':0,'fade_in':.8}]})
  self.assertEqual(e,original)
 def test_alpha_fades_are_in_local_clip_time(self):
  f=layer_fade_filter({'in':20,'out':22,'at':8,'fade_in':.2,'fade_out':.3})
  self.assertIn('st=0:',f);self.assertIn('st=1.7:',f);self.assertIn('alpha=1',f)
if __name__=='__main__':unittest.main()
