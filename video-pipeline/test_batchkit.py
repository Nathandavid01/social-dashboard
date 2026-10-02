import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import batchkit as batch
import editkit


class BatchTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for d in ('styles', 'edits', 'runs', 'media'):
            (self.root / d).mkdir()
        self.profile = {'slug': 'demo', 'name': 'Demo', 'client_id': 'client-demo',
                        'style': 'styles/style.json', 'feedback': 'styles/feedback.json',
                        'catalog': 'runs/catalog.json', 'recipe_prefix': 'demo'}
        def put(path, data):
            (self.root / path).write_text(json.dumps(data))
        put('styles/clients.json', {'clients': [self.profile]})
        put('styles/feedback.json', {})
        put('styles/style.json', {'font_file': 'font.ttf', 'max_words': 3, 'max_chars': 22})
        (self.root / 'styles/font.ttf').write_bytes(b'font')
        put('styles/audio-master.json', {})
        put('styles/music-usage.json', {})
        put('runs/catalog.json', {'ideas': [{'id': f'idea-{i}', 'title': f'Video {i}'} for i in range(3)]})
        (self.root / 'AGENTS.md').write_text('## Uso De AI\nReglas locales\n')
        for name in ('pipeline.py', 'audiokit.py', 'review_loop.py', 'effects.py', 'graphics.py'):
            (self.root / name).write_text('# engine')
        for target, value in [('batchkit.ROOT', self.root), ('editkit.ROOT', self.root),
                              ('editkit.CLIENTS_FILE', self.root / 'styles/clients.json')]:
            p = patch(target, value); p.start(); self.addCleanup(p.stop)
        p = patch('batchkit.pipeline.probe', return_value={'format': {'duration': '2'},
                  'streams': [{'codec_type': 'video', 'width': 1080, 'height': 1920}]})
        p.start(); self.addCleanup(p.stop)
        self.folder = self.root / 'runs' / 'lote'
        batch.start('demo', 'Edita tres videos', 3, self.folder)
        self.selection = []
        self.decisions = []
        for i in range(3):
            source = self.root / 'media' / f'{i}.mp4'; source.write_bytes(b'original')
            transcript = self.root / 'media' / f'{i}.json'
            transcript.write_text(json.dumps({'text': 'Hola', 'segments': [{'start': 0, 'end': 1,
                                   'text': 'Hola', 'words': [{'start': 0, 'end': 1, 'word': 'Hola'}]}]}))
            self.selection.append({'id': f'video-{i}', 'idea_id': f'idea-{i}',
                                   'source': str(source), 'transcript': str(transcript)})
            self.decisions.append({'id': f'video-{i}', 'clips': [{'in': 0, 'out': 1}],
                                   'editorial_note': 'Conservar frase completa.'})

    def ready(self):
        batch.select(self.folder, self.selection)
        batch.prepare(self.folder)
        batch.compose(self.folder, self.decisions)

    def test_editorial_montage_does_not_require_invented_spoken_words(self):
        path = Path(self.selection[0]['transcript'])
        path.write_text(json.dumps({'caption_mode': 'editorial', 'segments': [], 'text': 'Sketch sin voz'}))
        batch.select(self.folder, self.selection)
        with patch('batchkit.transcribe') as infer:
            result = batch.prepare(self.folder)
        infer.assert_not_called()
        self.assertEqual(result['jobs'][0]['status'], 'needs_editorial_plan')

    def test_missing_spoken_word_timings_still_fail(self):
        Path(self.selection[0]['transcript']).write_text(json.dumps({'segments': [], 'text': 'Hola'}))
        batch.select(self.folder, self.selection)
        self.assertEqual(batch.prepare(self.folder)['jobs'][0]['status'], 'prepare_failed')

    def render(self, recipe, output):
        output.write_bytes(b'export')
        digest = batch.audiokit.digest(output)
        batch.save(output.with_suffix('.audio.json'), {'status': 'pass', 'output_sha256': digest})
        batch.save(output.with_suffix('.review.json'), {'output_sha256': digest, 'nodes': [{'id': 'technical_check', 'status': 'pass'}]})
        batch.save(output.with_suffix('.json'), {'edit': batch.read(recipe), 'verification': {'full_decode': True}})

    def test_three_videos_resume_without_repeated_render_or_transcription(self):
        with patch('batchkit.transcribe') as infer:
            self.ready()
            infer.assert_not_called()
        with patch('batchkit.pipeline.render', side_effect=self.render) as render:
            result = batch.run_batch(self.folder)
            self.assertTrue(all(j['status'] == 'review_pending' for j in result['jobs']))
            batch.run_batch(self.folder)
            self.assertEqual(render.call_count, 3)
        self.assertTrue((self.folder / 'review.html').is_file())
        self.assertEqual(result['approval'], 'pending')

    def test_failed_video_does_not_stop_others_and_only_failure_retries(self):
        self.ready()
        def fail_one(recipe, output):
            if 'video-1' in str(output):
                raise RuntimeError('encoder interrupted')
            self.render(recipe, output)
        with patch('batchkit.pipeline.render', side_effect=fail_one):
            result = batch.run_batch(self.folder)
        self.assertEqual([x['status'] for x in result['jobs']], ['review_pending', 'render_failed', 'review_pending'])
        with patch('batchkit.pipeline.render', side_effect=self.render) as render:
            batch.run_batch(self.folder)
            self.assertEqual(render.call_count, 1)

    def test_revision_only_renders_one_video_and_preserves_previous(self):
        self.ready()
        with patch('batchkit.pipeline.render', side_effect=self.render):
            batch.run_batch(self.folder)
        previous = batch.read(self.folder / 'batch.json')['jobs'][0]['output']
        batch.compose(self.folder, self.decisions[:1])
        with patch('batchkit.pipeline.render', side_effect=self.render) as render:
            batch.run_batch(self.folder)
            self.assertEqual(render.call_count, 1)
        self.assertTrue(Path(previous).is_file())
        self.assertEqual(len(batch.read(self.folder / 'batch.json')['jobs'][0]['history']), 1)

    def test_changed_source_requires_revision(self):
        self.ready()
        with patch('batchkit.pipeline.render', side_effect=self.render):
            batch.run_batch(self.folder)
        Path(self.selection[0]['source']).write_bytes(b'changed media')
        with patch('batchkit.pipeline.render') as render:
            result = batch.run_batch(self.folder)
            render.assert_not_called()
        self.assertEqual(result['jobs'][0]['status'], 'render_failed')

    def test_incomplete_or_tampered_output_is_not_silently_accepted(self):
        self.ready()
        with patch('batchkit.pipeline.render', side_effect=self.render):
            batch.run_batch(self.folder)
        state = batch.read(self.folder / 'batch.json')
        Path(state['jobs'][0]['output']).write_bytes(b'tampered')
        with patch('batchkit.pipeline.render') as render:
            result = batch.run_batch(self.folder)
            render.assert_not_called()
        self.assertEqual(result['jobs'][0]['status'], 'render_failed')

    def test_stale_client_instructions_stop_execution(self):
        self.ready()
        (self.root / 'styles/feedback.json').write_text('{"new":"rule"}')
        with self.assertRaisesRegex(ValueError, 'refresh'):
            batch.run_batch(self.folder)

    def test_reedit_protected_idea_is_rejected(self):
        catalog = batch.read(self.root / 'runs/catalog.json')
        catalog['ideas'][0]['do_not_reedit'] = True
        batch.save(self.root / 'runs/catalog.json', catalog)
        batch.save(self.folder / 'context.json', batch.context('demo'))
        with self.assertRaisesRegex(ValueError, 'protegida'):
            batch.select(self.folder, self.selection)

    def test_invalid_plan_does_not_write_any_recipe(self):
        batch.select(self.folder, self.selection)
        self.decisions[-1]['clips'] = [{'in': 0, 'out': 20}]
        with self.assertRaises(ValueError):
            batch.compose(self.folder, self.decisions)
        self.assertEqual(list((self.root / 'edits').glob('*.json')), [])

    def test_feedback_style_overrides_registry_without_mutating_it(self):
        (self.root / 'styles/new.json').write_text('{}')
        batch.save(self.root / 'styles/feedback.json', {'current_style': 'styles/new.json'})
        self.assertEqual(editkit.load_profile('demo')['style'], 'styles/new.json')
        self.assertEqual(editkit.load_registry()['clients'][0]['style'], 'styles/style.json')

    def test_missing_profile_queries_metricool_once_and_preserves_request(self):
        folder = self.root / 'runs' / 'new-client'
        def fetch(command, **kwargs):
            out = Path(command[command.index('--out') + 1])
            out.mkdir(parents=True)
            batch.save(out / 'report.json', {'fetched_at': 'test', 'clients': [
                {'name': 'Nuevo Cliente', 'last10': [{'published': True, 'media': ['example.mp4']}]}]})
            from types import SimpleNamespace
            return SimpleNamespace(returncode=0)
        with patch('batchkit.subprocess.run', side_effect=fetch) as call:
            result = batch.start('Nuevo Cliente', 'Tres videos', 3, folder)
            batch.start('Nuevo Cliente', 'Tres videos', 3, folder)
        self.assertEqual(call.call_count, 1)
        self.assertEqual(result['status'], 'needs_style_reference')
        self.assertEqual(result['lookup'], 'published_posts_found')
        self.assertIn('--history-only', call.call_args.args[0])
        self.assertFalse((folder / 'batch.json').exists())

    def test_missing_style_for_known_client_uses_its_id_and_reports_failure(self):
        (self.root / 'styles/style.json').unlink()
        from types import SimpleNamespace
        with patch('batchkit.subprocess.run', return_value=SimpleNamespace(returncode=1)) as call:
            result = batch.start('demo', 'Tres videos', 3, self.root / 'runs' / 'missing-style')
        self.assertIn('client-demo', call.call_args.args[0])
        self.assertEqual(result['lookup'], 'failed')
        self.assertEqual(result['status'], 'needs_style_reference')

    def test_continue_same_folder_after_style_reference_is_resolved(self):
        folder = self.root / 'runs' / 'reference-resolved'
        folder.mkdir()
        batch.save(folder / 'style-request.json', {'lookup': 'published_posts_found'})
        result = batch.start('demo', 'Tres videos', 3, folder)
        self.assertEqual(result['count'], 3)
        self.assertTrue((folder / 'batch.json').exists())

    def test_wrong_client_idea_and_wrong_count_are_rejected(self):
        with self.assertRaises(ValueError):
            batch.select(self.folder, self.selection[:1])
        self.selection[0]['idea_id'] = 'other-client'
        with self.assertRaises(ValueError):
            batch.select(self.folder, self.selection)


if __name__ == '__main__':
    unittest.main()
