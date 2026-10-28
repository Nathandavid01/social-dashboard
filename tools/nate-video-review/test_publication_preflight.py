import copy
import json
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone, timedelta, timedelta
from pathlib import Path
from unittest.mock import patch
from publication_preflight import evaluate, load_and_evaluate, source_sha256, check_for_render, first_graph_node

NOW = datetime(2026, 10, 28, 12, 0, tzinfo=timezone.utc)
HASH = 'a' * 64

def example():
    return {'schema_version': 1, 'source_sha256': HASH, 'client_id': 'client-1',
            'checked_at': '2026-10-28T09:00:00+00:00', 'reviewer': 'revisor',
            'result': 'not_found_in_checked_scope',
            'limitations': ['Se cotejaron muestras; no cubre publicaciones manuales.'],
            'sources': [{'id': 'm1', 'platform': 'Metricool', 'account': 'Drop Coffee',
                         'from_date': '2026-09-01', 'to_date': '2026-10-28', 'access': 'reviewed'}],
            'comparisons': [{'source_id': 'm1', 'publication_id': 'post-1', 'publication_date': '2026-10-07',
                             'methods': ['visual', 'text'], 'scope': 'Muestras cada 3 segundos',
                             'observation': 'Entorno y toma distintos en muestras.', 'result': 'no_match'}]}

class PreflightTests(unittest.TestCase):
    def check(self, ev):
        return evaluate(ev, source_hash=HASH, client_id='client-1', now=NOW)
    def test_checked_scope_never_claims_universal_nonpublication(self):
        result = self.check(example())
        self.assertEqual(result['status'], 'checked_scope')
        self.assertIn('no demuestra', result['scope_notice'])
    def test_graph_node_is_scoped_to_source_and_export(self):
        node = first_graph_node(example(), source_hash=HASH, client_id='client-1', output_hash='b'*64, now=NOW)
        self.assertEqual(node['id'], 'publication_check')
        self.assertEqual(node['status'], 'checked_scope')
        self.assertEqual(node['output_sha256'], 'b'*64)
        self.assertNotIn('pass', node.values())
    def test_render_gate_requires_fresh_review_and_explicit_published_revision(self):
        ev = example()
        self.assertEqual(check_for_render(ev, source_hash=HASH, client_id='client-1', now=NOW)['render_gate'], 'proceed')
        stale = check_for_render(ev, source_hash=HASH, client_id='client-1', now=NOW+timedelta(days=2))
        self.assertEqual(stale['status'], 'pending')
        ev['result'] = 'duplicate'; ev['comparisons'][0]['result'] = 'match'
        self.assertNotIn('render_gate', check_for_render(ev, source_hash=HASH, client_id='client-1', now=NOW))
        self.assertEqual(check_for_render(ev, source_hash=HASH, client_id='client-1', now=NOW, authorized_published_revision=True)['render_gate'], 'proceed')

    def test_wrong_hash_or_client_is_pending(self):
        ev = example(); ev['source_sha256'] = 'b' * 64
        self.assertEqual(self.check(ev)['status'], 'pending')
        ev = example(); ev['client_id'] = 'other'
        self.assertEqual(self.check(ev)['status'], 'pending')
    def test_missing_sources_access_or_comparisons_is_pending(self):
        for mutate in (lambda e: e.update(sources=[]), lambda e: e.update(comparisons=[]),
                       lambda e: e['sources'][0].update(access='unavailable'),
                       lambda e: e.update(limitations=[])):
            ev = example(); mutate(ev)
            self.assertEqual(self.check(ev)['status'], 'pending')
    def test_duplicate_evidence_blocks_candidate(self):
        ev = example(); ev['result'] = 'duplicate'; ev['comparisons'][0]['result'] = 'match'
        self.assertEqual(self.check(ev)['status'], 'duplicate')
    def test_recent_audit_without_recent_source_range_is_pending(self):
        ev = example(); ev['sources'][0]['to_date'] = '2026-10-10'
        self.assertEqual(self.check(ev)['status'], 'pending')

    def test_conflicting_or_uncertain_comparison_is_pending(self):
        ev = example(); ev['comparisons'][0]['result'] = 'match'
        self.assertEqual(self.check(ev)['status'], 'pending')
        ev = example(); ev['comparisons'][0]['result'] = 'uncertain'
        self.assertEqual(self.check(ev)['status'], 'pending')
    def test_bad_or_future_dates_and_incomplete_comparison_are_pending(self):
        for mutate in (lambda e: e.update(checked_at='2027-01-01T00:00:00Z'),
                       lambda e: e['sources'][0].update(from_date='2026-15-01'),
                       lambda e: e['comparisons'][0].update(publication_date='2026-01-01'),
                       lambda e: e['comparisons'][0].update(methods=[{}])):
            ev = example(); mutate(ev)
            self.assertEqual(self.check(ev)['status'], 'pending')
    def test_insufficient_and_missing_report_stay_pending(self):
        ev = example(); ev['result'] = 'insufficient'
        self.assertEqual(self.check(ev)['status'], 'pending')
        with tempfile.TemporaryDirectory() as directory:
            src = Path(directory) / 'video.mp4'; src.write_bytes(b'video')
            self.assertEqual(load_and_evaluate(Path(directory)/'missing.json',source_path=src,client_id='client-1')['status'], 'pending')
    def test_cli_fails_closed_without_recent_valid_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); src = root / 'video.mp4'; src.write_bytes(b'video')
            ev = example(); ev['source_sha256'] = source_sha256(src)
            now = datetime.now(timezone.utc)
            ev['checked_at'] = (now - timedelta(days=2)).isoformat()
            day = (now - timedelta(days=3)).date().isoformat()
            ev['sources'][0].update(from_date=day, to_date=now.date().isoformat())
            ev['comparisons'][0]['publication_date'] = day
            report = root / 'report.json'; report.write_text(json.dumps(ev))
            result = subprocess.run([sys.executable, str(Path(__file__).with_name('publication_preflight.py')), '--source', str(src), '--client-id', 'client-1', '--evidence', str(report)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(json.loads(result.stdout)['status'], 'pending')
            ev['checked_at'] = (now - timedelta(minutes=1)).isoformat(); report.write_text(json.dumps(ev))
            result = subprocess.run([sys.executable, str(Path(__file__).with_name('publication_preflight.py')), '--source', str(src), '--client-id', 'client-1', '--evidence', str(report)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0)
            self.assertEqual(json.loads(result.stdout)['render_gate'], 'proceed')

    def test_loaded_file_is_checked_against_actual_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            src = Path(directory) / 'video.mp4'; src.write_bytes(b'video')
            ev = example(); ev['source_sha256'] = source_sha256(src)
            report = Path(directory) / 'report.json'; report.write_text(json.dumps(ev))
            self.assertEqual(load_and_evaluate(report,source_path=src,client_id='client-1',now=NOW)['status'], 'checked_scope')
            src.write_bytes(b'new bytes')
            self.assertEqual(load_and_evaluate(report,source_path=src,client_id='client-1',now=NOW)['status'], 'pending')



if __name__ == "__main__": unittest.main()
