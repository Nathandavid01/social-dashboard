"""Nigiri y sashimi v7 keeps the chef on camera and the swapped names off her mouth."""
import json
import unittest
from pathlib import Path

from effects import validate_event
from pipeline import cut_words

ROOT = Path(__file__).resolve().parent
RECIPE = ROOT / "edits/yabuuchi-sashimi-nigiri-v7.json"
RAW = ROOT / "runs/yabuuchi-transcripts/DJI_20260914121706_0983_D.json"


def words():
    raw = json.loads(RAW.read_text())
    return [w for segment in raw["segments"] for w in segment["words"]]


def spoken(part):
    kept = cut_words(words(), [{"in": part["in"], "out": part["out"]}])
    return " ".join(w["word"].strip(" ¿?").lower() for w in kept)


class SashimiNigiriV7Tests(unittest.TestCase):
    def setUp(self):
        self.edit = json.loads(RECIPE.read_text())

    @unittest.skipUnless(RAW.is_file(), 'Requires local source transcript; not distributed in Git')
    def test_question_names_both_and_answers_do_not(self):
        question, fish, rice, card = self.edit["source_parts"]
        self.assertEqual(question["use"], "voice_and_picture")
        self.assertIn("nigiri", spoken(question))
        self.assertIn("sashimi", spoken(question))
        self.assertEqual(spoken(fish), "es el pescado solito")
        self.assertNotIn("nigiri", spoken(rice))
        self.assertNotIn("sashimi", spoken(rice))
        self.assertIn("bolita de arroz", spoken(rice))
        self.assertEqual(card["use"], "illustrative_still")
        self.assertEqual(len([p for p in self.edit["source_parts"] if p["use"] == "illustrative_still"]), 1)

    def test_card_carries_the_names_and_the_outro_is_the_reel(self):
        text = " ".join(c["text"] for c in self.edit["captions"])
        self.assertNotIn("prefieres", text.lower())
        self.assertNotIn("minuto", text.lower())
        self.assertNotIn("el nigiri es", text.lower())
        self.assertIn("Es el pescado solito.", text)
        outro = self.edit["outro"]["source"]
        self.assertTrue(outro.endswith("outro-ig-reel-v1.mp4"))
        self.assertNotIn("piano", outro)
        self.assertEqual(self.edit["outro"]["out"], 2.92)
        body = self.edit["clips"][0]["out"]
        for event in self.edit["sounds"] + self.edit["effects"]:
            validate_event(event, body)
