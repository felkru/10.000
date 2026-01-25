import numpy as np
import torch
from .game import ZehntausendGame, GameConstants, Scorer

class ZehntausendEnv:
    def __init__(self):
        self.game = ZehntausendGame(num_players=2)
        self.action_space_size = 64 # 32 subsets * 2 (Bank/Continue)
    
    def reset(self):
        self.game.reset()
        # Initial roll for player 0
        roll = self.game.roll()
        # Check bust immediate?
        # A roll might yield NO scoring dice. 
        # If so, bust immediately and pass turn.
        # We need to loop until a player has a valid decision.
        return self._advance_to_decision_state()

    def _advance_to_decision_state(self):
        """
        Advances the game until a player needs to make a decision (i.e. valid roll).
        Handles busts automatically.
        """
        while not self.game.game_over:
            # Check if current roll has valid moves
            can_score, _, _ = Scorer.calculate_score(self.game.last_roll)
            # Actually calculate_score sums everything.
            # We need to check if ANY subset is valid.
            # Sufficient condition: Counts match any scoring dice (1, 5) or 3x/4x.
            # Helper function needed?
            # Scorer check:
            # If any 1 or 5 is present -> Valid.
            # If any count >= 3 -> Valid.
            # If neither -> Bust.
            
            from collections import Counter
            counts = Counter(self.game.last_roll)
            has_valid = (counts[1] > 0) or (counts[5] > 0)
            if not has_valid:
                for c in counts.values():
                    if c >= 3:
                        has_valid = True
                        break
            
            if has_valid:
                return self.get_state()
            else:
                # Bust
                self.game.bust()
                if not self.game.game_over:
                     self.game.roll()
        
        return self.get_state() # Game Over state

    def step(self, action_id):
        """
        Action ID: 0-63.
        Bit 5 (32): Bank (1) or Continue (0).
        Bits 0-4: Dice Mask.
        """
        if self.game.game_over:
            return self.get_state(), 0, True, {}

        scores_before = self.game.scores[:]
        
        should_bank = (action_id >> 5) & 1
        subset_mask = action_id & 31
        
        # Decode mask to indices
        subset_indices = []
        # game.last_roll usually has between 1 and 5 dice.
        # The mask corresponds to indices 0..4.
        # If index >= len(last_roll), ignore (or fail?).
        # Ideally agent learns not to pick non-existent dice.
        # But for validity check:
        current_num_dice = len(self.game.last_roll)
        
        for i in range(5):
            if (subset_mask >> i) & 1:
                if i < current_num_dice:
                    subset_indices.append(i)
                else:
                    # Invalid action: selected non-existent die
                    # Penalty? Or just ignore bit?
                    # Strict text: Invalid Action -> Loop same state or random?
                    # I will treat as invalid move -> Bust or massive penalty?
                    # Better: Filter legal actions in RL loop.
                    # Here: return penalty is easiest for training?
                    # But self-play logic usually masks logits.
                    # I'll let the game.validate_keep handle it.
                    pass
        
        if not self.game.validate_keep(subset_indices):
            # Invalid move
            # For RL training, we often return -1 reward and done, or ignore.
            # Given "Superhuman", masking is key.
            # Here I will return same state and a small penalty?
            # Or assume caller masked it.
            # I will raise error or return penalty to enforce masking.
            return self.get_state(), -10, False, {"error": "invalid_move"}

        # Apply Keep
        points = self.game.apply_keep(subset_indices)
        
        # Decide next
        if should_bank:
            if self.game.requires_proof:
                # Invalid bank
                return self.get_state(), -10, False, {"error": "cannot_bank_unproven"}
            
            self.game.bank()
            reward = 0 # Reward is sparse (Win/Loss)? Or score delta?
            # Usually strict Win/Loss +1/-1.
            # But "Cheap training" benefits from dense rewards.
            # I'll use dense reward for now = points / 10000.
            reward += points / 100.0
            
            if not self.game.game_over:
                self.game.roll()
                
        else:
            # Continue
            # We already decremented num_dice in apply_keep.
            # Just roll.
            self.game.roll()
            # If roll is Bust, next state will handle it in _advance
        
        next_state = self._advance_to_decision_state()
        
        # Reward shaping
        # If I scored points and didn't bust, good.
        # Step reward: points achieved this step?
        # If game won: +10.
        step_reward = points / 10000.0
        if self.game.game_over:
            if self.game.winner == (self.game.current_player - 1) % 2: # Current player just banked and won?
                 # Wait, bank() calls _next_turn(), so current_player is now opponent.
                 # Winner is set.
                 step_reward += 1.0
        
        done = self.game.game_over
        return next_state, step_reward, done, {}

    def get_legal_actions(self):
        """
        Returns mask [64] of valid actions.
        """
        mask = np.zeros(64, dtype=np.bool_) # Changed to bool_
        current_roll = self.game.last_roll
        n = len(current_roll)
        
        # Iterate all 32 subsets
        for m in range(32):
            subset_indices = []
            valid_mask_bits = True
            for i in range(5): # Mask 5 bits
                if (m >> i) & 1:
                    if i >= n:
                        valid_mask_bits = False
                        break
                    subset_indices.append(i)
            
            if not valid_mask_bits:
                continue
                
            if self.game.validate_keep(subset_indices):
                # Valid subset.
                # Check Bank (bit 5=1)
                
                # Check logic: Scorer check if this SPECIFIC move results in a proven state?
                subset = [current_roll[i] for i in subset_indices]
                _, has_pasch, has_15 = Scorer.calculate_score(subset)
                
                # Simulated next requirement:
                # next_req = (curr_req or has_pasch) and not has_15
                next_req = (self.game.requires_proof or has_pasch) and not has_15
                
                if not next_req:
                    mask[m | 32] = 1 # Bank allowed
                
                # Check Continue (bit 5=0)
                # Always allowed if subset valid
                mask[m] = 1
                
        return mask

    def get_state(self):
        """
        Vector:
        0-4: Dice values (1-6), 0 if empty.
        5: Turn Score / 10000
        6: My Score / 10000
        7: Opp Score / 10000
        8: My turn? (Always 1 for "current player" perspective, -1 for opponent?
           Actually self-play usually flips board.
           So State always looks like "It's MY turn".)
        9: Requires Proof (0 or 1)
        """
        s = np.zeros(10, dtype=np.float32)
        
        # Dice
        # We need to sort? Sorting helps NN (canonical).
        # Should we pad or just fill?
        # last_roll might have 2 dice.
        sorted_roll = sorted(self.game.last_roll)
        for i, d in enumerate(sorted_roll):
            s[i] = d / 6.0
            
        s[5] = self.game.turn_score / 10000.0
        
        # Current player score is always "My Score" relative to decision maker
        p = self.game.current_player
        s[6] = self.game.scores[p] / 10000.0
        s[7] = self.game.scores[1-p] / 10000.0
        
        s[8] = 1.0 # Indicator "Active"
        
        s[9] = 1.0 if self.game.requires_proof else 0.0
        
        return s

