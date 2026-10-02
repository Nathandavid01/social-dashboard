import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch

import local_transcription as local


class LocalTranscriptionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / 'source.mp4'
        self.source.write_bytes(b'original media')
        self.model = MagicMock()
        self.model.transcribe.return_value = {'text': 'Hola', 'segments': []}
        for target, value in [('local_transcription.CACHE', self.root / 'cache'),
                              ('local_transcription._MODELS', {})]:
            patcher = patch(target, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        patcher = patch('whisper.load_model', return_value=self.model)
        self.loader = patcher.start()
        self.addCleanup(patcher.stop)

    def test_identical_content_at_another_path_uses_cache(self):
        local.transcribe(self.source, self.root / 'one.json', 'base')
        duplicate = self.root / 'duplicate.mp4'
        duplicate.write_bytes(self.source.read_bytes())
        local.transcribe(duplicate, self.root / 'two.json', 'base')
        self.assertEqual(self.model.transcribe.call_count, 1)
        self.assertEqual(self.loader.call_count, 1)

    def test_source_prompt_and_model_changes_invalidate_cache(self):
        local.transcribe(self.source, self.root / 'one.json', 'base')
        self.source.write_bytes(b'changed original')
        local.transcribe(self.source, self.root / 'two.json', 'base')
        local.transcribe(self.source, self.root / 'three.json', 'base', 'Cliente')
        local.transcribe(self.source, self.root / 'four.json', 'small', 'Cliente')
        self.assertEqual(self.model.transcribe.call_count, 4)
        self.assertEqual(self.loader.call_count, 2)

    def test_manual_corrections_are_preserved(self):
        output = self.root / 'one.json'
        result = local.transcribe(self.source, output, 'base')
        result['text'] = 'Corrección manual'
        output.write_text(json.dumps(result))
        self.assertEqual(local.transcribe(self.source, output, 'base')['text'], 'Corrección manual')
        self.assertEqual(self.model.transcribe.call_count, 1)

    def test_legacy_output_is_never_overwritten(self):
        output = self.root / 'legacy.json'
        output.write_text('{"text":"corregido"}')
        with self.assertRaises(ValueError):
            local.transcribe(self.source, output, 'base')
        self.loader.assert_not_called()
        self.assertEqual(output.read_text(), '{"text":"corregido"}')

    def test_changed_original_cannot_reuse_existing_output(self):
        output = self.root / 'one.json'
        local.transcribe(self.source, output, 'base')
        self.source.write_bytes(b'changed')
        with self.assertRaises(ValueError):
            local.transcribe(self.source, output, 'base')
        self.assertEqual(self.model.transcribe.call_count, 1)

    def test_busy_worker_does_not_load_model(self):
        import fcntl
        local.CACHE.mkdir()
        with (local.CACHE / '.inference.lock').open('a') as handle:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.assertRaises(RuntimeError):
                local.transcribe(self.source, self.root / 'one.json', 'base')
        self.loader.assert_not_called()

    def test_partial_result_is_not_published_on_failure(self):
        self.model.transcribe.side_effect = RuntimeError('interrupted')
        with self.assertRaises(RuntimeError):
            local.transcribe(self.source, self.root / 'one.json', 'base')
        self.assertFalse((self.root / 'one.json').exists())
        self.assertEqual(list(local.CACHE.glob('*.json')), [])


if __name__ == '__main__':
    unittest.main()
