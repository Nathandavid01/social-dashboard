import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LEARNED = ROOT / 'styles' / 'metricool-learned.json'
FAMILIES = {'white_sentence', 'white_upper', 'yellow_upper', 'brand_color', 'process_silent'}


class MetricoolLearnedTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads(LEARNED.read_text())

    def test_house_rules_are_present(self):
        house = self.data['house']
        self.assertEqual(house['format'], '1080x1920')
        self.assertIn('outro', house)
        self.assertEqual(house['captions_default']['caption_animation'], 'none')

    def test_each_client_has_a_known_caption_family(self):
        slugs = []
        for client in self.data['clients']:
            with self.subTest(slug=client.get('slug')):
                self.assertIn(client['family'], FAMILIES)
                self.assertIn(client['caption_case'], {'natural', 'upper'})
                self.assertTrue(client['slug'])
                self.assertTrue(client['notes'])
                slugs.append(client['slug'])
        self.assertEqual(len(slugs), len(set(slugs)))
        self.assertGreaterEqual(len(slugs), 20)

    def test_file_does_not_embed_secrets(self):
        raw = LEARNED.read_text().lower()
        for needle in ('metricool_token', 'x-mc-auth', 'service_role', 'sk-ant', 'xai-'):
            self.assertNotIn(needle, raw)


if __name__ == '__main__':
    unittest.main()
