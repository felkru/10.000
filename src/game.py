from collections import Counter
from dataclasses import dataclass
from typing import List, Tuple, Optional

@dataclass
class TurnState:
    turn_score: int
    kept_dice_mask: List[bool] # Not strictly needed if we just track remaining count, but good for validity
    num_dice_available: int
    requires_proof: bool # If True, player cannot bank and must roll 1 or 5

class GameConstants:
    WINNING_SCORE = 10000
    NUM_DICE = 5

class Scorer:
    @staticmethod
    def calculate_score(dice: List[int]) -> Tuple[int, bool, bool]:
        """
        Calculates score for a GIVEN SUBSET of dice.
        Returns:
            points: int
            has_pasch: bool (True if subset contains 3x or 4x)
            has_one_or_five: bool (True if subset contains 1 or 5 independent of Paschs? 
                           Actually, just "contains 1 or 5" is the check for proof satisfaction)
        """
        counts = Counter(dice)
        score = 0
        has_pasch = False
        
        # Check for 4x
        for num in range(1, 7):
            if counts[num] >= 4:
                has_pasch = True
                if num == 1:
                    score += 10000 # Instant win / 10k
                else:
                    score += num * 1000 # 2 -> 2000
                counts[num] -= 4
        
        # Check for 3x
        for num in range(1, 7):
            if counts[num] >= 3:
                has_pasch = True
                if num == 1:
                    score += 1000
                else:
                    score += num * 100
                counts[num] -= 3
                
        # Remainder 1s and 5s
        score += counts[1] * 100
        score += counts[5] * 50
        
        has_one_or_five = (1 in dice) or (5 in dice)
        
        return score, has_pasch, has_one_or_five

    @staticmethod
    def is_valid_subset(subset: List[int]) -> bool:
        """
        Checks if the subset consists ENTIRELY of scoring dice/combinations.
        You cannot keep non-scoring dice.
        """
        if not subset:
            return False
            
        counts = Counter(subset)
        
        # Verify 4x
        for num in range(1, 7):
            if counts[num] >= 4:
                counts[num] -= 4
                
        # Verify 3x
        for num in range(1, 7):
            if counts[num] >= 3:
                counts[num] -= 3
        
        # Verify remainder are 1s or 5s
        for num, count in counts.items():
            if count > 0:
                if num not in [1, 5]:
                    return False
        
        return True

class ZehntausendGame:
    def __init__(self, num_players=1): # Self-play can manage players externally, but engine can internalize
        self.num_players = num_players
        self.reset()
        
    def reset(self):
        self.scores = [0] * self.num_players
        self.current_player = 0
        self.turn_score = 0
        self.num_dice = GameConstants.NUM_DICE
        self.requires_proof = False
        self.last_roll = []
        self.game_over = False
        self.winner = None
        
    def roll(self) -> List[int]:
        """Exposed for env to call, or called internally?"""
        import random
        self.last_roll = sorted([random.randint(1, 6) for _ in range(self.num_dice)])
        return self.last_roll

    def validate_keep(self, subset_indices: List[int]) -> bool:
        if not subset_indices:
            return False
        if max(subset_indices) >= len(self.last_roll):
            return False
        
        subset_values = [self.last_roll[i] for i in subset_indices]
        return Scorer.is_valid_subset(subset_values)

    def apply_keep(self, subset_indices: List[int]) -> Tuple[int, bool]:
        """
        Calculates points, updates info.
        Returns (points_added, is_bust)
        But wait, if you keep valid dice, you don't bust. You bust if you roll and get NOTHING.
        This function just processes the decision.
        
        Logic:
        1. Calculate score of kept dice.
        2. Update proof status.
        3. Update num_dice.
        4. Return score.
        """
        subset = [self.last_roll[i] for i in subset_indices]
        points, has_pasch, has_1_or_5 = Scorer.calculate_score(subset)
        
        self.turn_score += points
        
        # Update Proof State
        # Logic: next_requires = (requires_prev OR has_pasch) AND NOT has_1/5
        self.requires_proof = (self.requires_proof or has_pasch) and not has_1_or_5
        
        # Update Dice
        num_kept = len(subset)
        self.num_dice -= num_kept
        
        # Anschluss (Hot Hand)
        if self.num_dice == 0:
            self.num_dice = GameConstants.NUM_DICE
            
        return points

    def bank(self):
        if self.requires_proof:
            raise ValueError("Cannot bank: Proof required.")
        
        self.scores[self.current_player] += self.turn_score
        if self.scores[self.current_player] >= GameConstants.WINNING_SCORE:
            self.game_over = True
            self.winner = self.current_player
            
        self._next_turn()
        
    def _next_turn(self):
        self.current_player = (self.current_player + 1) % self.num_players
        self.turn_score = 0
        self.num_dice = GameConstants.NUM_DICE
        self.requires_proof = False
        self.last_roll = []

    def bust(self):
        self._next_turn()

