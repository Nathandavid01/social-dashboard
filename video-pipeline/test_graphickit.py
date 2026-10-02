import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw
from graphics import cutout_image, inspect_alpha, overlay_filter, validate_graphic
from graphickit import apply_graphics, write_new


class GraphicKitTests(unittest.TestCase):
    def test_cutout_removes_plain_background(self):
        image = Image.new('RGB', (200, 200), (255, 255, 255))
        draw = ImageDraw.Draw(image)
        draw.ellipse((60, 60, 140, 140), fill=(180, 40, 40))
        cut = cutout_image(image, fuzz=20)
        info = inspect_image_via_temp(cut)
        self.assertGreaterEqual(info['transparent_ratio'], .2)
        self.assertGreaterEqual(info['opaque_ratio'], .1)
        self.assertEqual(cut.mode, 'RGBA')

    def test_jpeg_without_alpha_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'photo.jpg'
            Image.new('RGB', (80, 80), (20, 20, 20)).save(path, quality=90)
            info = inspect_alpha(path)
            with self.assertRaises(ValueError) as error:
                validate_graphic({
                    'source': 'photo.jpg', 'start': 1, 'end': 2, 'x': 90, 'y': 1100, 'width': 200,
                    '_alpha': info,
                }, 5)
            self.assertIn('transparente', str(error.exception))

    def test_overlay_keeps_rgba_and_timeline_window(self):
        graphic = {'start': 1.4, 'end': 2.3, 'x': 90, 'y': 1180, 'width': 280, 'enter': .18, 'source': 'a.png'}
        scale, over, name = overlay_filter(4, graphic, 'effect0', 0)
        self.assertIn('format=rgba', scale)
        self.assertIn("enable='between(t,1.4,2.3)'", over)
        self.assertEqual(name, 'graphic0')

    def test_graphic_cannot_cover_captions(self):
        info = {'has_alpha': True, 'transparent_ratio': .4, 'opaque_ratio': .4, 'size': (280, 250)}
        with self.assertRaises(ValueError):
            validate_graphic({
                'source': 'a.png', 'start': 0, 'end': 1, 'x': 90, 'y': 1700, 'width': 280,
                '_alpha': info,
            }, 4, {'bottom_margin': 300})

    def test_apply_does_not_overwrite_recipe_or_original(self):
        original = {'clips': [{'in': 0, 'out': 8}], 'sounds': []}
        with tempfile.TemporaryDirectory() as tmp:
            png = Path(tmp) / 'cut.png'
            Image.new('RGBA', (100, 80), (10, 10, 10, 0)).paste(Image.new('RGBA', (40, 40), (200, 30, 30, 255)), (30, 20))
            Image.new('RGBA', (100, 80), (0, 0, 0, 0)).save(png)
            # Build a cutout with real hole and subject.
            canvas = Image.new('RGBA', (120, 120), (0, 0, 0, 0))
            ImageDraw.Draw(canvas).ellipse((30, 30, 90, 90), fill=(200, 40, 40, 255))
            canvas.save(png)
            recipe = Path(tmp) / 'idea-v1.json'
            dest = Path(tmp) / 'idea-v2.json'
            write_new(recipe, original)
            patched = apply_graphics(original, [{
                'source': png.name, 'start': 1, 'end': 2, 'x': 90, 'y': 1100, 'width': 200, 'sound': 'pop',
            }], recipe_dir=tmp)
            write_new(dest, patched)
            self.assertEqual(json.loads(recipe.read_text())['clips'][0]['out'], 8)
            self.assertEqual(len(patched['graphics']), 1)
            self.assertEqual(patched['sounds'][0]['preset'], 'pop')
            with self.assertRaises(ValueError):
                write_new(dest, patched)


def inspect_image_via_temp(image):
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / 'x.png'
        image.save(path)
        return inspect_alpha(path)


if __name__ == '__main__':
    unittest.main()
