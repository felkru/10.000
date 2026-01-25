import unittest
from src.game import Scorer, ZehntausendGame, GameConstants

class TestScorer(unittest.TestCase):
    def test_calculate_score_simple(self):
        # 1 = 100
        score, pasch, has15 = Scorer.calculate_score([1])
        self.assertEqual(score, 100)
        self.assertFalse(pasch)
        self.assertTrue(has15)

        # 5 = 50
        score, pasch, has15 = Scorer.calculate_score([5])
        self.assertEqual(score, 50)
        self.assertTrue(has15)

        # 2 = 0
        score, pasch, has15 = Scorer.calculate_score([2])
        self.assertEqual(score, 0)
        self.assertFalse(has15)

    def test_calculate_score_triples(self):
        # 3x2 = 200
        score, pasch, has15 = Scorer.calculate_score([2, 2, 2])
        self.assertEqual(score, 200)
        self.assertTrue(pasch)
        self.assertFalse(has15)

        # 3x1 = 1000
        score, pasch, has15 = Scorer.calculate_score([1, 1, 1])
        self.assertEqual(score, 1000)
        self.assertTrue(pasch)
        self.assertTrue(has15) # 1 is present

        # 3x5 = 500
        score, pasch, has15 = Scorer.calculate_score([5, 5, 5])
        self.assertEqual(score, 500)
        self.assertTrue(pasch)
        self.assertTrue(has15)

    def test_calculate_score_quads(self):
        # 4x2 = 2000
        score, pasch, has15 = Scorer.calculate_score([2, 2, 2, 2])
        self.assertEqual(score, 2000)
        self.assertTrue(pasch)

        # 4x1 = 10000
        score, pasch, has15 = Scorer.calculate_score([1, 1, 1, 1])
        self.assertEqual(score, 10000)
        self.assertTrue(pasch)

    def test_mixed(self):
        # 1, 5, 2 -> 150
        score, pasch, has15 = Scorer.calculate_score([1, 5, 2])
        self.assertEqual(score, 150)
        self.assertFalse(pasch)
        self.assertTrue(has15)

    def test_valid_subset(self):
        self.assertTrue(Scorer.is_valid_subset([1]))
        self.assertTrue(Scorer.is_valid_subset([2, 2, 2]))
        self.assertFalse(Scorer.is_valid_subset([2])) # Junk
        self.assertFalse(Scorer.is_valid_subset([1, 2])) # 1 is valid, 2 is junk

class TestGameFlow(unittest.TestCase):
    def setUp(self):
        self.game = ZehntausendGame()

    def test_proof_logic(self):
        # Scenario: Roll 2,2,2 (200).
        self.game.last_roll = [2, 2, 2, 3, 4]
        # Keep 2,2,2
        self.game.apply_keep([0, 1, 2])
        
        self.assertEqual(self.game.turn_score, 200)
        self.assertTrue(self.game.requires_proof)
        
        # Try to bank
        with self.assertRaises(ValueError):
            self.game.bank()
            
        # Roll again: 1, 6
        self.game.last_roll = [1, 6]
        # Keep 1
        self.game.apply_keep([0])
        
        self.assertEqual(self.game.turn_score, 300)
        self.assertFalse(self.game.requires_proof)
        
        # Valid bank
        try:
            self.game.bank()
        except ValueError:
            self.fail("Should be able to bank")

    def test_proof_satisfaction_same_roll(self):
        # Scenario: Roll 2,2,2, 1
        self.game.last_roll = [2, 2, 2, 1, 4]
        # Keep 2,2,2, 1
        self.game.apply_keep([0, 1, 2, 3])
        
        self.assertEqual(self.game.turn_score, 300)
        self.assertFalse(self.game.requires_proof)

    def test_anschluss(self):
        self.game.last_roll = [1, 1, 1, 5, 5] # 5 dice
        self.game.apply_keep([0, 1, 2, 3, 4]) # Keep all 5 (1000 + 100) -> 1100
        
        self.assertEqual(self.game.num_dice, 5) # Reset to 5
        self.assertEqual(self.game.turn_score, 1100)

if __name__ == '__main__':
    unittest.main()
