from __future__ import annotations
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.metrics import DetectionEpisode, classification_metrics, count_false_positive_episodes, false_positive_episodes_per_background_hour

class MetricsTests(unittest.TestCase):
    def test_classification_metrics(self):
        result = classification_metrics(["a", "a", "b", "b"], ["a", "b", "b", "b"], ["a", "b"])
        self.assertEqual(result["confusion_matrix"], [[1, 1], [0, 2]]); self.assertAlmostEqual(result["macro_recall"], .75)
    def test_false_positive_episode_merging(self):
        episodes = [DetectionEpisode(0, .4, True), DetectionEpisode(.8, 1.2, True), DetectionEpisode(5, 5.4, True), DetectionEpisode(8, 8.4, False)]
        self.assertEqual(count_false_positive_episodes(episodes), 2); self.assertAlmostEqual(false_positive_episodes_per_background_hour(episodes, 3600), 2.0)

if __name__ == "__main__": unittest.main()
