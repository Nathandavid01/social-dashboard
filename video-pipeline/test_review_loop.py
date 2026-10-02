import json
import subprocess
import tempfile
import unittest
from pathlib import Path

import review_loop

ROOT = Path(__file__).resolve().parent


class ReviewLoopFontTests(unittest.TestCase):
    """El nodo de referencias incluye la fuente solo cuando el render declara font_file."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)
        self.video = self.dir / 'demo-v1.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=1080x1920:d=1:r=30',
                        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(self.video)], check=True)
        catalog = self.dir / 'catalog.json'
        catalog.write_text(json.dumps({'fetched_at': 'hoy', 'ideas': [{'id': 'idea-1', 'title': 'Idea', 'hook': 'Gancho'}]}))
        self.outro = self.dir / 'outro.mp4'
        self.outro.write_bytes(b'outro')
        self.report = {
            'status': 'local_draft',
            'edit': {'idea_id': 'idea-1', 'catalog': str(catalog), 'references': {'outro': str(self.outro)}},
            'style': {'name': 'sin captions propios'},
            'captions': [],
            'verification': {'full_decode': True},
            'output': {'streams': [{'codec_type': 'video', 'width': 1080, 'height': 1920}]},
        }

    def build(self):
        self.video.with_suffix('.json').write_text(json.dumps(self.report))
        return review_loop.build(self.video)

    def test_render_without_font_file_has_no_font_reference_and_no_missing_asset(self):
        graph = self.build()
        self.assertEqual([r['role'] for r in graph['references']], ['outro'])
        technical = next(n for n in graph['nodes'] if n['id'] == 'technical_check')
        self.assertEqual(technical['findings'], [])
        self.assertEqual(technical['status'], 'pass')

    def test_render_with_font_file_still_lists_the_font(self):
        self.report['edit']['style'] = '../styles/arecibo.json'
        self.report['style'] = {'font_file': '../tests/fixtures/Montserrat-Bold.ttf'}
        graph = self.build()
        fonts = [r for r in graph['references'] if r['role'] == 'font']
        self.assertEqual(len(fonts), 1)
        self.assertEqual(fonts[0]['path'], 'tests/fixtures/Montserrat-Bold.ttf')
        self.assertTrue(fonts[0]['exists'])

    def test_missing_audio_report_forces_changes_required(self):
        graph = self.build()
        audio = next(n for n in graph['nodes'] if n['id'] == 'audio_master')
        self.assertEqual(audio['status'], 'fail')
        self.assertEqual(graph['status'], 'changes_required')


if __name__ == '__main__':
    unittest.main()
