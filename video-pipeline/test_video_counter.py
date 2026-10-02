import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from video_counter import git_sync, read, record_finished


class VideoCounterTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.ledger = self.root / 'completed-videos.json'
        self.ledger.write_text(json.dumps({'clients': [{'key': 'client-id',
            'aliases': ['Client'], 'style_prefixes': ['client']}], 'count': 0, 'videos': {}}))

    def export(self, name='reel-v1', idea='idea-1', client='client-id'):
        video = self.root / (name + '.mp4')
        video.write_bytes(b'verified export ' + name.encode())
        digest = hashlib.sha256(video.read_bytes()).hexdigest()
        video.with_suffix('.json').write_text(json.dumps({'edit': {'client_id': client,
            'idea_id': idea, 'title': 'A video'}, 'verification': {'full_decode': True,
            'audio_master_status': 'pass'}}))
        video.with_suffix('.review.json').write_text(json.dumps({'output_sha256': digest,
            'nodes': [{'id': 'render', 'status': 'pass'}]}))
        video.with_suffix('.audio.json').write_text(json.dumps({'status': 'pass',
            'output_sha256': digest}))
        return video

    def record(self, video):
        return record_finished(video, ledger_path=self.ledger, sync=False)

    def test_revision_and_client_alias_keep_one_video(self):
        self.assertEqual(self.record(self.export())['count'], 1)
        self.assertEqual(self.record(self.export('reel-v2', client='Client'))['status'], 'already_counted')
        self.assertEqual(read(self.ledger)['count'], 1)
        self.assertEqual(self.record(self.export('other-v1', idea='idea-2'))['count'], 2)

    def test_failed_checks_and_stale_hash_do_not_count(self):
        video = self.export()
        report = read(video.with_suffix('.json'))
        report['verification']['full_decode'] = False
        video.with_suffix('.json').write_text(json.dumps(report))
        with self.assertRaises(ValueError):
            self.record(video)
        self.assertEqual(read(self.ledger)['count'], 0)
        video = self.export()
        video.write_bytes(b'different, unverified media')
        with self.assertRaises(ValueError):
            self.record(video)
        self.assertEqual(read(self.ledger)['count'], 0)

    def test_tests_are_not_counted(self):
        self.assertEqual(self.record(self.export(idea='smoke-1'))['status'], 'excluded')
        self.assertEqual(read(self.ledger)['count'], 0)

    def test_concurrent_finishes_do_not_lose_or_duplicate_counts(self):
        videos = [self.export(f'video-{i}', idea=f'idea-{i}') for i in range(10)]
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            list(pool.map(self.record, videos + videos))
        self.assertEqual(read(self.ledger)['count'], 10)
        self.assertEqual(len(read(self.ledger)['videos']), 10)

    def test_git_commits_only_counter_and_pushes(self):
        def git(*args):
            return subprocess.run(['git', '-C', str(self.root), *args], check=True,
                                  capture_output=True, text=True).stdout.strip()
        git('init', '-b', 'counter-test')
        git('config', 'user.name', 'Counter Test')
        git('config', 'user.email', 'counter@example.test')
        (self.root / 'unrelated.txt').write_text('unrelated staged work')
        git('add', 'unrelated.txt')
        self.assertEqual(git_sync(self.ledger, 0)['status'], 'pending_push')
        self.assertEqual(git('show', '--format=', '--name-only', 'HEAD'), 'completed-videos.json')
        self.assertIn('unrelated.txt', git('diff', '--cached', '--name-only'))
        remote = self.root / 'remote.git'
        subprocess.run(['git', 'init', '--bare', str(remote)], check=True, capture_output=True)
        git('remote', 'add', 'origin', str(remote))
        self.assertEqual(git_sync(self.ledger, 0)['status'], 'pushed')
        self.assertEqual(git('rev-parse', 'HEAD'), subprocess.run(['git', '--git-dir', str(remote),
            'rev-parse', 'refs/heads/counter-test'], check=True, capture_output=True, text=True).stdout.strip())


if __name__ == '__main__':
    unittest.main()
