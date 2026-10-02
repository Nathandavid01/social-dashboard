"""Signal-level regressions and real FFmpeg round trips for the audio delivery gate."""
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import numpy as np

import audiokit as ak


def tone(seconds, rms_db=-23, phase_inverted=False):
    t = np.arange(round(seconds * ak.RATE)) / ak.RATE
    x = np.sin(2 * np.pi * 440 * t) * 10 ** (rms_db / 20) * np.sqrt(2)
    return np.column_stack((x, -x if phase_inverted else x)).astype(np.float32)


class AudioSignals(unittest.TestCase):
    def test_bad_settings_do_not_reach_ffmpeg(self):
        for values in ({'target_lufs': float('nan')}, {'true_peak_dbtp': 0},
                       {'max_voice_boost_db': 40}, {'target_lufs': True}, {'mode': 'guess'}):
            with self.subTest(values=values), self.assertRaises(ValueError):
                ak.settings({'audio_master': values})
        with self.assertRaises(ValueError):
            ak.settings({'audio_master': {'typo': 10}})

    def test_manual_balance_is_preserved_by_default(self):
        self.assertEqual(ak.settings({'voice_adjustment': {'gain_db': -9}})['voice_mode'], 'preserve')
        self.assertEqual(ak.settings({'caption_mode': 'editorial'})['mode'], 'music')

    def test_invalid_or_overlapping_regions_are_rejected(self):
        for regions in ([{'start': 1, 'end': 3}], [{'start': -1, 'end': 1}],
                        [{'start': 0, 'end': 1}, {'start': .9, 'end': 2}],
                        [{'start': 0, 'end': float('inf')}]):
            with self.assertRaises(ValueError):
                ak.validate_regions(regions, 2)

    def test_transcript_splits_questions_answers_and_speaker_changes(self):
        words = [{'start': 0, 'end': .5, 'word': '¿Cuál?'},
                 {'start': .55, 'end': 1.1, 'word': 'Este.', 'speaker': 'B'},
                 {'start': 1.4, 'end': 2, 'word': 'Perfecto.'}]
        regions, provenance = ak.speech_regions(words, 2)
        self.assertEqual(len(regions), 3)
        self.assertIn('not_speaker_diarization', provenance)

    def test_loud_question_and_quiet_answer_become_balanced(self):
        samples = np.concatenate([tone(1, -10), np.zeros((4800, 2)), tone(1, -28)])
        regions = [{'start': 0, 'end': 1}, {'start': 1.1, 'end': 2.1}]
        result, records = ak.level_regions(samples, regions, ak.settings())
        levels = [ak.active_rms(result[round(r['start']*ak.RATE):round(r['end']*ak.RATE)]) for r in regions]
        self.assertLess(abs(levels[0] - levels[1]), .1)
        self.assertAlmostEqual(levels[0], -23, delta=.1)
        self.assertLess(records[0]['gain_db'], -10)
        self.assertGreater(records[1]['gain_db'], 0)
        self.assertEqual(len(result), len(samples))

    def test_silence_and_very_low_noise_are_not_boosted(self):
        samples = np.concatenate([np.zeros((48000, 2)), tone(1, -55)])
        result, records = ak.level_regions(samples, [{'start': 0, 'end': 1}, {'start': 1, 'end': 2}], ak.settings())
        np.testing.assert_array_equal(samples, result)
        self.assertTrue(all(r['noise_or_silence_skipped'] for r in records))

    def test_inverted_stereo_does_not_cancel_measurement(self):
        self.assertAlmostEqual(ak.active_rms(tone(1, -24, True)), -24, delta=.1)

    def test_last_answer_does_not_inherit_question_gain(self):
        # The previous FFmpeg volume expression held its last large frame for 2 seconds.
        samples = np.concatenate([tone(1, -10), np.zeros((9600, 2)), tone(2, -23)])
        result, _ = ak.level_regions(samples, [{'start': 0, 'end': 1}], ak.settings())
        np.testing.assert_array_equal(result[round(1.2*ak.RATE):], samples[round(1.2*ak.RATE):])

    def test_nonfinite_loudness_is_json_safe_and_fails_gate(self):
        m = ak.parse_loudnorm('{"input_i":"-inf","input_tp":"-inf","input_lra":"0","input_thresh":"-70","target_offset":"inf"}')
        json.dumps(m, allow_nan=False)
        self.assertTrue(ak.checks(m, ak.settings()))


class AudioRoundTrips(unittest.TestCase):
    def test_hot_transient_is_bounded_in_encoded_delivery(self):
        with tempfile.TemporaryDirectory() as folder:
            source, output = Path(folder)/'hot.wav', Path(folder)/'final.m4a'
            signal = tone(4, -27)
            t = np.arange(960) / ak.RATE
            burst = (.95 * np.sin(2 * np.pi * 6000 * t)).astype(np.float32)
            signal[2*ak.RATE:2*ak.RATE+len(t)] = burst[:, None]
            ak.write_float(source, signal)
            before = ak.measure(source)
            self.assertGreater(before['input_tp'], -1)
            report = ak.normalize(source, output)
            self.assertLessEqual(report['after']['input_tp'], -1.95)
            self.assertEqual(report['status'], 'pass')

    def test_dynamic_loudnorm_does_not_lengthen_delivery(self):
        # Delian Visita v5 (2026-09-23): loudnorm dinámico añadió ~90 ms y el gate rechazó el render.
        with tempfile.TemporaryDirectory() as folder:
            source, output = Path(folder)/'hot-odd.wav', Path(folder)/'final.m4a'
            # LRA > lra_lu (medido en ventanas de 3 s) fuerza loudnorm dinámico, como el premaster real.
            signal = np.concatenate([tone(3, -40), tone(3, -24), tone(3, -38), tone(3, -22), tone(3.617, -36)])
            click_at = round(10.5 * ak.RATE)  # marcador para medir que no hay desfase A/V
            signal[click_at:click_at + 48] = .9
            ak.write_float(source, signal)
            # Hasta 2026-09-29 esta señal fallaba el gate: el loudnorm dinámico quedaba en ~−21.3 LUFS
            # y no había reintento por sonoridad. Ahora el reintento compensado debe entregar dentro del gate.
            report = ak.normalize(source, output)
            self.assertEqual(report['status'], 'pass')
            self.assertEqual(report['attempts'][0]['normalization_type'], 'dynamic')
            self.assertAlmostEqual(ak.measure(output)['input_i'], -20, delta=1)
            self.assertLessEqual(ak.measure(output)['input_tp'], -1.95)
            for attempt in report['attempts']:  # la entrega no se alarga en ningún intento
                self.assertNotIn('La duración cambió más de 60 ms', attempt['findings'])
                self.assertLessEqual(attempt['duration_delta'], .03)
            # El recorte es de la cola: el clic sigue en su sitio (±5 ms), sin desfase.
            delivered = ak.decode(output)[:, 0]
            window = delivered[click_at - ak.RATE // 2: click_at + ak.RATE // 2]
            found = click_at - ak.RATE // 2 + int(np.argmax(np.abs(np.diff(window))))
            self.assertLessEqual(abs(found - click_at) / ak.RATE, .005)

    def test_mono_measurement_matches_stereo_delivery(self):
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            ak.write_float(folder/'stereo.wav', tone(3, -24))
            source, output = folder/'mono.wav', folder/'final.m4a'
            ak.run([ak.FFMPEG, '-v', 'error', '-i', str(folder/'stereo.wav'), '-ac', '1', str(source)])
            report = ak.normalize(source, output)
            self.assertEqual(report['status'], 'pass')
            self.assertAlmostEqual(report['after']['input_i'], -20, delta=1)
            stream = next(s for s in ak.probe(output)['streams'] if s['codec_type']=='audio')
            self.assertEqual(stream['channels'], 2)

    def test_master_measures_encoded_aac_and_preserves_video(self):
        with tempfile.TemporaryDirectory(prefix='Audio kit ') as folder:
            folder = Path(folder)
            wav = folder / 'voice.wav'
            ak.write_float(wav, tone(3, -23))
            source, output = folder / 'source.mkv', folder / 'reel.mp4'
            ak.run([ak.FFMPEG, '-v', 'error', '-nostdin', '-f', 'lavfi', '-i',
                    'color=black:size=160x90:rate=30:duration=3', '-i', str(wav),
                    '-c:v', 'libx264', '-threads', '1', '-c:a', 'pcm_s24le', '-shortest', str(source)])
            report = ak.normalize(source, output)
            self.assertEqual(report['status'], 'pass')
            self.assertLessEqual(report['after']['input_tp'], -1.95)
            self.assertAlmostEqual(report['after']['input_i'], -20, delta=1)
            self.assertEqual(report['output_sha256'], ak.digest(output))
            def vhash(p):
                return ak.run([ak.FFMPEG, '-v', 'error', '-i', str(p), '-map', '0:v:0',
                               '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-']).stdout
            self.assertEqual(vhash(source), vhash(output))
            with self.assertRaises(ValueError):
                ak.normalize(source, output)

    def test_silent_input_fails_without_publishing(self):
        with tempfile.TemporaryDirectory() as folder:
            source, output = Path(folder)/'silent.wav', Path(folder)/'output.wav'
            ak.write_float(source, np.zeros((3*ak.RATE, 2)))
            with self.assertRaises(ValueError):
                ak.normalize(source, output)
            self.assertFalse(output.exists())

    def test_cut_and_reordered_voice_keeps_exact_duration(self):
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            ak.write_float(folder/'source.wav', np.concatenate([tone(1, -12), tone(1, -28)]))
            edit = {'source': 'source.wav', 'clips': [{'in': 1, 'out': 2}, {'in': 0, 'out': 1}],
                    'audio_master': {'speech_regions': [{'start': 0, 'end': 1}, {'start': 1, 'end': 2}]}}
            work = folder/'work'; work.mkdir()
            path, report = ak.prepare_voice(folder/'edit.json', edit, [], work, ak.settings(edit))
            self.assertEqual(len(ak.decode(path)), 2*ak.RATE)
            self.assertLess(report['voice_spread_db'], 3)
            self.assertGreater(report['regions'][0]['gain_db'], 0)
            self.assertLess(report['regions'][1]['gain_db'], 0)


class LoudnessCompensation(unittest.TestCase):
    """Decisión de reintentos de normalize() con FFmpeg simulado (medidas controladas)."""
    SOURCE = {'input_i': -15.2, 'input_tp': -.5, 'input_lra': 11.4, 'input_thresh': -25.8,
              'target_offset': 1.3, 'normalization_type': 'dynamic'}

    def normalize(self, afters):
        filters, afters = [], list(afters)
        def fake_measure(path, cfg=None, prefilter='anull', ceiling=None):
            return afters.pop(0) if Path(path).name.startswith('mastered-') else dict(self.SOURCE)
        def fake_run(args, **kwargs):
            if '-af' in args:
                filters.append(args[args.index('-af') + 1])
                Path(args[-1]).write_bytes(b'candidate')
            return SimpleNamespace(stdout='', stderr=json.dumps(self.SOURCE))
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        folder = Path(tmp.name)
        source = folder / 'mix.wav'
        source.write_bytes(b'mix')
        probe = {'streams': [{'codec_type': 'audio'}], 'format': {'duration': '8.5'}}
        with patch.multiple(ak, measure=fake_measure, run=fake_run, probe=lambda p: probe,
                            publish_file=lambda a, b: Path(b).write_bytes(Path(a).read_bytes())):
            try:
                return ak.normalize(source, folder / 'out.m4a'), filters
            except ValueError:
                report = json.loads((folder / 'out-audio-work' / 'audio-master-report.json').read_text())
                return report, filters

    @staticmethod
    def after(i, tp):
        return dict(LoudnessCompensation.SOURCE, input_i=i, input_tp=tp)

    def test_loudness_shortfall_retries_with_compensated_filter_target(self):
        report, filters = self.normalize([self.after(-21.05, -6.2), self.after(-19.9, -6.1)])
        self.assertEqual(report['status'], 'pass')
        self.assertEqual([a['filter_target_lufs'] for a in report['attempts']], [-20, -18.95])
        self.assertIn('loudnorm=I=-18.95:', filters[1])
        self.assertEqual(report['settings']['target_lufs'], -20)  # el gate no se mueve

    def test_compensation_is_bounded_and_happens_once(self):
        report, filters = self.normalize([self.after(-26, -9), self.after(-24, -9)])
        self.assertEqual(report['status'], 'needs_correction')
        self.assertEqual([a['filter_target_lufs'] for a in report['attempts']], [-20, -17.0])
        self.assertEqual(len(filters), 2)

    def test_true_peak_failure_lowers_ceiling_instead_of_compensating(self):
        report, _ = self.normalize([self.after(-20.1, -1.5), self.after(-20.0, -2.3)])
        self.assertEqual(report['status'], 'pass')
        first, second = report['attempts']
        self.assertEqual(first['filter_target_lufs'], second['filter_target_lufs'])
        self.assertLess(second['ceiling_dbtp'], first['ceiling_dbtp'])

    def test_loudness_and_true_peak_failure_does_not_compensate(self):
        report, _ = self.normalize([self.after(-21.5, -1.0), self.after(-21.4, -2.3)])
        self.assertEqual(report['attempts'][1]['filter_target_lufs'], -20)


if __name__ == '__main__':
    unittest.main()
