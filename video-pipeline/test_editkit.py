import copy
import json
import tempfile
import unittest
from pathlib import Path

from editkit import (
    ROOT, add_broll, belongs_to, build_learned_style, bump_recipe, classify_pending,
    draft_captions, family_name, fold_name, inspect_recipe, load_learned, load_profile,
    load_registry, next_free_path, parse_version, scaffold_recipe, status, summarize_pending,
    window_words, write_new,
)
class EditKitTests(unittest.TestCase):
    def test_unknown_client_lists_known_slugs(self):
        with self.assertRaises(ValueError) as error:
            load_profile('king-uniforms')
        self.assertIn('yabuuchi', str(error.exception))
        self.assertIn('nanas', str(error.exception))

    def test_published_style_does_not_copy_another_client(self):
        import editkit
        learned = load_learned()
        cafe = next(item for item in learned['clients'] if item['slug'] == 'cafe-el-bosque')
        truco = next(item for item in learned['clients'] if item['slug'] == 'truco')
        with tempfile.TemporaryDirectory() as tmp:
            original = editkit.LEARNED_STYLE_DIR
            editkit.LEARNED_STYLE_DIR = Path(tmp)
            try:
                profile = load_profile('Café El Bosque', learned=learned)
                style = json.loads((Path(tmp) / 'cafe-el-bosque.json').read_text())
            finally:
                editkit.LEARNED_STYLE_DIR = original
        self.assertEqual(profile['source'], 'metricool-learned')
        self.assertEqual(profile['slug'], 'cafe-el-bosque')
        self.assertEqual(style['family'], 'white_sentence')
        self.assertNotEqual(style.get('primary_colour'), truco.get('primary_colour', '&H0014E4F1'))
        self.assertEqual(load_profile('El Truco de Guin')['slug'], 'truco')
        self.assertEqual(load_profile('El Truco de Guin').get('source'), None)
        # Dashboard spells it without the apostrophe. That still has to use the Nana's profile.
        self.assertEqual(load_profile('Nanas Playhouse')['slug'], 'nanas')
        self.assertNotEqual(load_profile('Nanas Playhouse').get('source'), 'metricool-learned')
        silent = build_learned_style(
            {'slug': 'laut', 'family': 'process_silent', 'notes': 'sin captions', 'caption_case': 'natural'},
            learned['house'],
        )
        self.assertEqual(silent['caption_mode'], 'none')
        self.assertNotEqual(cafe['family'], 'yellow_upper')

    def test_queue_keeps_unedited_raws_and_blocks_unknown_style(self):
        payload = {'ideas': [
            {'client_name': 'Café El Bosque', 'client_id': 'cafe', 'idea_id': 'plato', 'title': 'Plato favorito',
             'status': 'grabada', 'raws': [{'id': 'raw-1', 'provider': 'r2', 'bytes': 14_000_000}]},
            {'client_name': 'Café El Bosque', 'client_id': 'cafe', 'idea_id': 'ya', 'title': 'Ya editado',
             'status': 'grabada', 'edited': 1, 'raws': [{'id': 'raw-2', 'provider': 'r2', 'bytes': 10}]},
            {'client_name': 'Café El Bosque', 'client_id': 'cafe', 'idea_id': 'pub', 'title': 'Publicado',
             'status': 'publicada', 'raws': [{'id': 'raw-3', 'provider': 'r2', 'bytes': 10}]},
            {'client_name': 'Lucas', 'client_id': 'lucas', 'idea_id': 'trend', 'title': 'trend',
             'status': 'grabada', 'raws': [{'id': 'raw-4', 'provider': 'r2', 'bytes': 10}]},
            {'client_name': 'Karen Licenciada', 'client_id': 'karen', 'idea_id': 'k', 'title': 'Caso',
             'status': 'grabada', 'raws': [{'id': 'raw-5', 'provider': 'drive', 'bytes': 10}]},
            {'client_name': 'El Truco de Guin', 'client_id': 'truco', 'idea_id': 'sandwich', 'title': 'Sandwich',
             'status': 'grabada', 'raws': [{'id': 'raw-6', 'provider': 'r2', 'bytes': 0}]},
        ]}
        rows = classify_pending(payload, load_registry(), load_learned())
        by_id = {row['idea_id']: row for row in rows}
        self.assertIn('plato', by_id)
        self.assertNotIn('ya', by_id)
        self.assertNotIn('pub', by_id)
        self.assertEqual(by_id['plato']['style_source'], 'metricool-learned')
        self.assertEqual(by_id['plato']['downloadable'], ['raw-1'])
        self.assertEqual(by_id['trend']['style_source'], 'missing')
        self.assertIn('falta referencia publicada', by_id['trend']['blockers'][0])
        self.assertTrue(any('Drive' in item for item in by_id['k']['blockers']))
        self.assertEqual(by_id['sandwich']['downloadable'], [])
        self.assertEqual(by_id['sandwich']['style_source'], 'profile')
        summary = summarize_pending(rows)
        cafe = next(item for item in summary if fold_name(item['client_name']) == fold_name('Café El Bosque'))
        self.assertEqual(cafe['ideas'], 1)
        self.assertEqual(cafe['downloadable'], 1)

    def test_aliases_and_uuid_resolve_to_the_same_profile(self):
        by_alias = load_profile('yabushi')
        by_uuid = load_profile('0b870c21-70f0-44ad-8319-352e55cf377f')
        self.assertEqual(by_alias['slug'], 'yabuuchi')
        self.assertEqual(by_uuid['slug'], 'yabuuchi')
        self.assertEqual(by_alias['caption_case'], 'natural')
        self.assertEqual(load_profile("nana's")['slug'], 'nanas')
        self.assertEqual(load_profile('Los Cheesys')['slug'], 'cheesys')

    def test_profiles_point_at_existing_style_and_outro(self):
        for client in load_registry()['clients']:
            with self.subTest(client=client['slug']):
                self.assertTrue((ROOT / client['style']).is_file(), client['style'])
                if client.get('outro'):
                    self.assertTrue(client['outro']['source'])
                    outro = ROOT / 'edits' / client['outro']['source']
                    if outro.is_file():
                        self.assertGreater(outro.stat().st_size, 0)
                if client.get('feedback'):
                    self.assertTrue((ROOT / client['feedback']).is_file())

    def test_next_version_skips_to_free_slot_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            v4 = folder / 'demo-v4.json'
            v4.write_text('{}')
            (folder / 'demo-v5.json').write_text('{}')
            dest = next_free_path(v4)
            self.assertEqual(dest.name, 'demo-v6.json')
            dest.write_text('{}')
            self.assertEqual(next_free_path(v4).name, 'demo-v7.json')

    def test_parse_version_rejects_unversioned_name(self):
        with self.assertRaises(ValueError):
            parse_version('toolkit-demo')

    def test_status_keeps_recipe_families_separate(self):
        profile = load_profile('yabuuchi')
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            for name, idea in (
                ('yabuuchi-churrasco-roll-v4.json', 'churrasco-roll'),
                ('yabuuchi-seleccion-churrasco-roll-v5.json', 'churrasco-roll'),
                ('yabuuchi-primer-sushi-v3.json', 'primer-sushi'),
            ):
                (folder / name).write_text(json.dumps({
                    'client_id': profile['client_id'],
                    'idea_id': idea,
                    'title': name,
                    'style': '../styles/yabuuchi-reference-v4.json',
                }))
            rows = status(profile, 'churrasco-roll', folder)
            families = {row['family']: row['version'] for row in rows}
            self.assertEqual(families['yabuuchi-churrasco-roll'], 4)
            self.assertEqual(families['yabuuchi-seleccion-churrasco-roll'], 5)
            self.assertNotIn('yabuuchi-primer-sushi', families)

    def test_does_not_mix_nanas_recipe_into_yabuuchi(self):
        yabuuchi = load_profile('yabuuchi')
        nanas = load_profile('nanas')
        path = Path('edits/practico-v14.json')
        data = {'client_id': nanas['client_id'], 'style': '../styles/nanas-quartzo.json'}
        self.assertFalse(belongs_to(yabuuchi, path, data))
        self.assertTrue(belongs_to(nanas, path, data))

    def test_window_remaps_words_and_rejects_mid_word_cuts(self):
        words = [
            {'start': 1.0, 'end': 1.4, 'word': 'Hola'},
            {'start': 1.5, 'end': 2.0, 'word': 'chef'},
            {'start': 5.0, 'end': 5.4, 'word': 'afuera'},
        ]
        window = window_words(words, 1.0, 2.0)
        self.assertEqual(window['text'], 'Hola chef')
        self.assertEqual(window['duration'], 1.0)
        self.assertEqual(window['words'][0]['start'], 0)
        with self.assertRaises(ValueError):
            window_words(words, 1.2, 2.0)

    def test_caption_case_and_truco_question_color(self):
        words = [
            {'start': 0, 'end': 0.4, 'word': 'Quieres'},
            {'start': 0.4, 'end': 0.8, 'word': 'sashimi?'},
            {'start': 1.2, 'end': 1.6, 'word': 'Sí'},
        ]
        clips = [{'in': 0, 'out': 2}]
        natural = draft_captions(words, clips, {'max_words': 4, 'max_chars': 40}, 'natural')
        upper = draft_captions(words, clips, {'max_words': 4, 'max_chars': 40}, 'upper')
        self.assertTrue(any('Quieres' in item['text'] or 'sashimi' in item['text'] for item in natural))
        self.assertTrue(all(item['text'] == item['text'].upper() for item in upper))
        truco = draft_captions(
            words, clips,
            {'max_words': 4, 'max_chars': 40, 'prompt_colour': '&H0014E4F1', 'answer_colour': '&H00FFFFFF'},
            'upper',
        )
        question = next(item for item in truco if item['text'].endswith('?'))
        answer = next(item for item in truco if not item['text'].endswith('?'))
        self.assertEqual(question['primary_colour'], '&H0014E4F1')
        self.assertEqual(answer['primary_colour'], '&H00FFFFFF')

    def test_scaffold_uses_client_style_and_outro_without_mixing(self):
        profile = load_profile('yabuuchi')
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'take.mp4'
            transcript = Path(tmp) / 'take.json'
            source.write_bytes(b'x')
            transcript.write_text('{"segments":[]}')
            recipe = scaffold_recipe(profile, 'primer-sushi', source, transcript, [{'in': 1, 'out': 3}])
        self.assertEqual(recipe['client_id'], profile['client_id'])
        self.assertEqual(recipe['style'], '../styles/yabuuchi-reference-v6.json')
        self.assertEqual(recipe['outro']['source'], profile['outro']['source'])
        self.assertEqual(recipe['clips'][0]['audio_edge_fade'], 0.015)
        self.assertEqual(family_name(profile, 'primer-sushi'), 'yabuuchi-primer-sushi')
        self.assertEqual(family_name(load_profile('nanas'), 'practico'), 'practico')

    def test_write_new_and_bump_never_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            first = folder / 'demo-v1.json'
            write_new(first, {'title': 'uno', 'review_notes': []})
            with self.assertRaises(ValueError):
                write_new(first, {'title': 'dos'})
            dest, result = bump_recipe(first, 'corrección')
            self.assertEqual(dest.name, 'demo-v2.json')
            self.assertEqual(json.loads(first.read_text())['title'], 'uno')
            self.assertEqual(result['title'], 'uno')
            self.assertIn('corrección', result['review_notes'])
            self.assertTrue(dest.is_file())

    def test_caption_tail_does_not_extend_past_timeline(self):
        words = [{'start': 0, 'end': 1, 'word': 'Hola'}]
        captions = draft_captions(words, [{'in': 0, 'out': 1}], {'max_words': 3, 'max_chars': 22})
        self.assertEqual(captions[-1]['end'], 1)

    def test_broll_validates_and_leaves_original_untouched(self):
        edit = {'clips': [{'in': 0, 'out': 10}], 'broll': [], 'sounds': []}
        original = copy.deepcopy(edit)
        layer = {'source': '../media/x.mp4', 'in': 0.3, 'out': 2.1, 'at': 4.0, 'reason': 'producto'}
        result = add_broll(edit, layer, source_duration=5, timeline_duration=10, whoosh=True)
        self.assertEqual(edit, original)
        self.assertEqual(result['broll'][0]['reason'], 'producto')
        self.assertEqual(result['sounds'][0]['preset'], 'whoosh_soft')
        self.assertEqual(result['sounds'][0]['time'], 4.0)
        with self.assertRaises(ValueError):
            add_broll(edit, {'in': 0, 'out': 3, 'at': 9}, 5, 10)
        self.assertEqual(edit, original)

    def test_inspect_reports_timeline_and_next_version(self):
        recipe = {
            'idea_id': 'primer-sushi',
            'title': 'Tu Primer Sushi',
            'clips': [{'in': 1.78, 'out': 10.05}],
            'captions': [{}, {}],
            'broll': [{'at': 4.84, 'in': 0.3, 'out': 4.33, 'source': 'x.mp4', 'reason': 'roll'}],
        }
        info = inspect_recipe(recipe, Path('edits/yabuuchi-primer-sushi-v4.json'))
        self.assertEqual(info['timeline'], 8.27)
        self.assertEqual(info['captions'], 2)
        self.assertEqual(info['version'], 4)
        self.assertEqual(info['next'], 'yabuuchi-primer-sushi-v5.json')
        self.assertEqual(info['broll'][0]['reason'], 'roll')

    def test_empty_and_partial_transcripts(self):
        self.assertEqual(draft_captions([], [{'in': 0, 'out': 2}], {'max_words': 3, 'max_chars': 20}), [])
        words = [{'start': 0, 'end': 0.3, 'word': 'Hola'}, {'start': 0.3, 'end': 0.3, 'word': ''}]
        groups = draft_captions(words, [{'in': 0, 'out': 1}], {'max_words': 3, 'max_chars': 20}, 'natural')
        self.assertEqual(groups[0]['text'], 'Hola')


if __name__ == '__main__':
    unittest.main()
