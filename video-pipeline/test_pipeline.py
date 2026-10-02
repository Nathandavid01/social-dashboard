import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from pipeline import cut_words, group_captions, validate_edit, ass_escape, validate_broll, write_ass, transcribe, resolve_captions, inverted_caption_colours


class TimelineTests(unittest.TestCase):
    def test_transcription_prompt_is_neutral_unless_supplied(self):
        model = MagicMock()
        model.transcribe.return_value = {'text': 'Hola', 'segments': []}
        with tempfile.TemporaryDirectory() as tmp, patch('whisper.load_model', return_value=model), patch('torch.set_num_threads'), patch('local_transcription.CACHE', Path(tmp) / 'cache'), patch('local_transcription._MODELS', {}):
            source = Path(tmp) / 'source.mp4'
            source.write_bytes(b'fixture')
            transcribe(source, Path(tmp) / 'neutral.json', 'base')
            self.assertIsNone(model.transcribe.call_args.kwargs['initial_prompt'])
            transcribe(source, Path(tmp) / 'delian.json', 'base', 'Dra. Delian Loyola')
            self.assertEqual(model.transcribe.call_args.kwargs['initial_prompt'], 'Dra. Delian Loyola')

    def test_caption_mode_none_does_not_burn_words(self):
        mapped = [{'start': 0, 'end': .4, 'word': 'Hola'}]
        style = {'max_words': 3, 'max_chars': 20}
        self.assertEqual(resolve_captions({'caption_mode': 'none', 'captions': []}, mapped, style), [])
        burned = resolve_captions({}, mapped, style)
        self.assertEqual(burned[0]['text'], 'HOLA')

    def test_words_follow_reordered_cuts(self):
        words = [{'start': 1, 'end': 1.3, 'word': 'Hola'}, {'start': 5, 'end': 5.4, 'word': 'Nana'}]
        clips = [{'in': 4, 'out': 6}, {'in': 0, 'out': 2}]
        result = cut_words(words, clips)
        self.assertEqual([w['word'] for w in result], ['Nana', 'Hola'])
        self.assertEqual([w['start'] for w in result], [1, 3])

    def test_reject_cut_through_word(self):
        with self.assertRaises(ValueError):
            cut_words([{'start': 1, 'end': 2, 'word': 'Completa'}], [{'in': 1.5, 'out': 3}])

    def test_captions_break_at_pause_and_length(self):
        words = [{'start': 0, 'end': .2, 'word': 'Hola'}, {'start': .2, 'end': .4, 'word': 'amigos'},
                 {'start': 2, 'end': 2.4, 'word': 'Nana'}]
        groups = group_captions(words, max_words=3, max_chars=20)
        self.assertEqual([g['text'] for g in groups], ['HOLA AMIGOS', 'NANA'])
        self.assertLessEqual(groups[0]['end'], 2)

    def test_captions_can_keep_natural_case(self):
        words = [{'start': 0, 'end': .2, 'word': 'Hola'}, {'start': .2, 'end': .4, 'word': 'amigos'}]
        groups = group_captions(words, max_words=3, max_chars=20, uppercase=False)
        self.assertEqual([g['text'] for g in groups], ['Hola amigos'])

    def test_invalid_timeline(self):
        for clips in [[], [{'in': -1, 'out': 2}], [{'in': 1, 'out': 20}], [{'in': 2, 'out': 1}], [{'in': 0, 'out': float('nan')}]]:
            with self.assertRaises(ValueError):
                validate_edit(clips, 10)

    def test_phone_numbers_never_carry_trailing_punctuation(self):
        # Regla de Eric 2026-09-23: ningún teléfono en caption lleva punto afuera.
        # Solo el teléfono: el resto del texto conserva su puntuación.
        from pipeline import clean_caption_text
        self.assertEqual(clean_caption_text('787-230-7573.'), '787-230-7573')
        self.assertEqual(clean_caption_text('al 787-230-7573, o escríbenos'), 'al 787-230-7573, o escríbenos')
        self.assertEqual(clean_caption_text('llama al (787) 230 7573...'), 'llama al (787) 230 7573')
        self.assertEqual(clean_caption_text('7872307573.\ndanos una llamadita.'), '7872307573\ndanos una llamadita.')
        self.assertEqual(clean_caption_text('es la prevención.'), 'es la prevención.')
        self.assertEqual(clean_caption_text('2. Diseño de sonrisa'), '2. Diseño de sonrisa')
        self.assertEqual(clean_caption_text('¿$7.99 te salva?'), '¿$7.99 te salva?')

    def test_render_writes_phone_without_period(self):
        font = Path(__file__).parent / 'tests/fixtures/Montserrat-Bold.ttf'
        style = {'font_family': 'Montserrat', 'font_size': 100, 'bottom_margin': 525, 'fixed_size': True}
        from pipeline import clean_captions
        captions = clean_captions([{'start': 0, 'end': 1, 'text': '787-230-7573.'}])
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'c.ass'
            write_ass(captions, style, out, font)
            dialogue = [l for l in out.read_text().splitlines() if l.startswith('Dialogue')][0]
        self.assertTrue(dialogue.endswith('787-230-7573'))

    def test_list_number_never_orphaned_on_its_own_line(self):
        # Delian Cinco Opciones v4: «3.» quedó solo encima de «Blanqueamiento» / «dental».
        from PIL import ImageFont
        from pipeline import wrap_balanced
        font = ImageFont.truetype(str(Path(__file__).parent / 'tests/fixtures/Montserrat-Bold.ttf'), 100)
        lines = wrap_balanced('3. Blanqueamiento dental', font, 900)
        self.assertEqual(lines, ['3. Blanqueamiento', 'dental'])
        self.assertEqual(wrap_balanced('2. Diseño de sonrisa', font, 900), ['2. Diseño', 'de sonrisa'])

    def test_zoom_cap_follows_source_resolution(self):
        close = [{'in': 0, 'out': 2, 'zoom': 1.55}]
        with self.assertRaises(ValueError):
            validate_edit(close, 10)
        validate_edit(close, 10, max_zoom=1.6)
        for bad in [{'in': 0, 'out': 2, 'zoom': 1.7}, {'in': 0, 'out': 2, 'focus_y': 1.2}, {'in': 0, 'out': 2, 'focus_y': -.1}]:
            with self.assertRaises(ValueError):
                validate_edit([bad], 10, max_zoom=1.6)
        validate_edit([{'in': 0, 'out': 2, 'zoom': 1.5, 'focus_y': .2}], 10, max_zoom=1.6)

    def test_max_zoom_is_lossless_limit_of_source(self):
        from pipeline import max_zoom_for
        self.assertAlmostEqual(max_zoom_for({'streams': [{'codec_type': 'video', 'width': 1728, 'height': 3072}]}), 1.6)
        self.assertEqual(max_zoom_for({'streams': [{'codec_type': 'video', 'width': 1080, 'height': 1920}]}), 1.3)
        self.assertEqual(max_zoom_for({'streams': [{'codec_type': 'video', 'width': 2160, 'height': 3840}]}), 1.8)

    def test_ass_cannot_inject_animation(self):
        escaped = ass_escape('Hola{\\pos(0,0)}\nMundo')
        self.assertNotIn('{', escaped)
        self.assertNotIn('\\', escaped)

    def test_broll_cannot_exceed_source_or_timeline(self):
        for layer in [{'in': 0, 'out': 6, 'at': 1}, {'in': 0, 'out': 3, 'at': 9}, {'in': 0, 'out': 2, 'at': -1}]:
            with self.assertRaises(ValueError):
                validate_broll(layer, source_duration=5, timeline_duration=10)
        validate_broll({'in': .5, 'out': 2.5, 'at': 3}, 5, 10)

    def test_truco_alignment_and_prompt_color(self):
        font = Path('/System/Library/Fonts/Supplemental/Impact.ttf')
        style = {
            'font_family': 'Impact', 'font_size': 80, 'bottom_margin': 800,
            'alignment': 2, 'primary_colour': '&H0014E4F1', 'outline_colour': '&H00000000',
            'outline': 6, 'shadow': 2, 'fixed_size': True, 'caption_animation': 'none',
            'wrap_width': 900, 'margin_x': 60, 'bold': -1, 'border_style': 1,
        }
        captions = [
            {'start': 0, 'end': 1, 'text': 'SAMI CUENTAME.'},
            {'start': 1, 'end': 2, 'text': 'EL SABOR ES RICO', 'primary_colour': '&H00FFFFFF'},
        ]
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'captions.ass'
            write_ass(captions, style, out, font)
            text = out.read_text()
        self.assertIn(',2,60,60,800,1', text)
        self.assertIn(r'{\c&H00FFFFFF&}', text)
        self.assertIn('SAMI CUENTAME.', text)

    def test_behind_camera_question_inverts_box_and_outline(self):
        font = Path('/System/Library/Fonts/Supplemental/Impact.ttf')
        box_style = {
            'font_family': 'Impact', 'font_size': 70, 'bottom_margin': 420,
            'alignment': 2, 'primary_colour': '&H00FFFFFF', 'outline_colour': '&H00000000',
            'outline': 0, 'shadow': 0, 'fixed_size': True, 'caption_animation': 'none',
            'margin_x': 80, 'bold': -1, 'border_style': 1,
            'caption_box': {'colour': '&H003B6EF4', 'alpha': '00', 'radius': 28,
                            'padding_x': 28, 'padding_y': 12, 'line_height': 70},
        }
        question = {'start': 0, 'end': 1, 'text': '¿Quieres una cerveza?', 'behind_camera': True}
        answer = {'start': 1, 'end': 2, 'text': 'No, quiero dos'}
        self.assertEqual(
            inverted_caption_colours(question, box_style),
            {'primary_colour': '&H003B6EF4', 'box_colour': '&H00FFFFFF'},
        )
        self.assertIsNone(inverted_caption_colours(answer, box_style))
        self.assertIsNone(inverted_caption_colours(
            {'start': 0, 'end': 1, 'text': '¿Y tú qué quieres?'}, box_style))
        outline_style = {
            'font_family': 'Impact', 'font_size': 70, 'bottom_margin': 420,
            'primary_colour': '&H00FFFFFF', 'outline_colour': '&H00000000',
            'border_style': 1, 'caption_animation': 'none', 'fixed_size': True,
            'outline': 6, 'shadow': 0, 'margin_x': 80, 'bold': -1,
        }
        self.assertEqual(
            inverted_caption_colours({'text': '¿Qué música?', 'behind_camera': True}, outline_style),
            {'primary_colour': '&H00000000', 'outline_colour': '&H00FFFFFF'},
        )
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'captions.ass'
            write_ass([question, answer], box_style, out, font)
            text = out.read_text()
        self.assertIn(r'{\c&H003B6EF4&}', text)
        self.assertEqual(text.count(r'\c&H003B6EF4&'), 2)
        self.assertEqual(text.count(r'\c&H00FFFFFF&'), 1)
        self.assertLess(text.index(r'\c&H00FFFFFF&'), text.index('¿Quieres una cerveza?'))
        self.assertIn('No, quiero dos', text)
        self.assertEqual(box_style['primary_colour'], '&H00FFFFFF')
        self.assertEqual(box_style['caption_box']['colour'], '&H003B6EF4')
        opaque = {
            'font_family': 'Impact', 'font_size': 70, 'bottom_margin': 420,
            'primary_colour': '&H00FFFFFF', 'outline_colour': '&H00000000',
            'back_colour': '&H64000000', 'border_style': 3,
            'caption_animation': 'none', 'fixed_size': True,
            'outline': 0, 'shadow': 0, 'margin_x': 80, 'bold': -1,
        }
        self.assertEqual(
            inverted_caption_colours({'text': '¿Hola?', 'behind_camera': True}, opaque),
            {'primary_colour': '&H00000000', 'back_colour': '&H64FFFFFF'},
        )
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'opaque.ass'
            write_ass([{'start': 0, 'end': 1, 'text': '¿Hola?', 'behind_camera': True}], opaque, out, font)
            opaque_text = out.read_text()
        self.assertIn(r'{\c&H00000000&}', opaque_text)
        self.assertIn(r'{\4c&H64FFFFFF&}', opaque_text)
        self.assertEqual(opaque['back_colour'], '&H64000000')


if __name__ == '__main__':
    unittest.main()
