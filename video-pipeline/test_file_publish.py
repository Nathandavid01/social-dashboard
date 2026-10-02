import errno
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from file_publish import publish_file


class PublishTests(unittest.TestCase):
    def test_external_volume_fallback_preserves_existing_files(self):
        with tempfile.TemporaryDirectory() as directory:
            source, target = Path(directory) / 'source', Path(directory) / 'target'
            source.write_bytes(b'completed render')
            with patch('file_publish.os.link', side_effect=OSError(errno.ENOTSUP, 'unsupported')):
                publish_file(source, target)
                self.assertEqual(target.read_bytes(), source.read_bytes())
                with self.assertRaises(FileExistsError):
                    publish_file(source, target)
                self.assertEqual(target.read_bytes(), b'completed render')

    def test_failed_copy_removes_only_its_partial_file(self):
        with tempfile.TemporaryDirectory() as directory:
            source, target = Path(directory) / 'source', Path(directory) / 'target'
            source.write_bytes(b'completed render')
            with patch('file_publish.os.link', side_effect=OSError(errno.ENOTSUP, 'unsupported')), patch('file_publish.shutil.copyfileobj', side_effect=OSError('disk full')):
                with self.assertRaises(OSError):
                    publish_file(source, target)
            self.assertFalse(target.exists())
            self.assertEqual(source.read_bytes(), b'completed render')
