import gymnasium as gym
from gymnasium import spaces
import numpy as np
import farkle_core

class FarkleEnv(gym.Env):
    metadata = {"render_modes": ["human"]}

    def __init__(self, render_mode=None, illegal_action_penalty=10.0):
        super(FarkleEnv, self).__init__()
        self.engine = farkle_core.FarkleEngine(num_players=2)
        self.illegal_action_penalty = illegal_action_penalty
        
        # Observation Space:
        # - 6 Dice values (1-6)
        # - 6 Dice states (0: ROLLED, 1: KEPT, 2: BANKED)
        # - Turn score (normalized roughly by 10000)
        # - Current keep score (normalized)
        # - My total score (normalized)
        # - Opponent total score (normalized)
        # Total: 16 features
        self.observation_space = spaces.Box(
            low=0, high=1, shape=(16,), dtype=np.float32
        )

        # Action Space:
        # 128 discrete actions:
        # - 0-63: Toggle keep for bitmask and then ROLL
        # - 64-127: Toggle keep for bitmask and then BANK
        self.action_space = spaces.Discrete(128)

    def _get_obs(self):
        obs = np.zeros(16, dtype=np.float32)
        for i, d in enumerate(self.engine.dice):
            obs[i] = d.value / 6.0
            obs[i + 6] = float(int(d.state)) / 2.0
        
        obs[12] = self.engine.turn_score / 10000.0
        obs[13] = self.engine.current_keep_score / 10000.0
        obs[14] = self.engine.player_scores[self.engine.current_player_index] / 10000.0
        obs[15] = self.engine.player_scores[(self.engine.current_player_index + 1) % 2] / 10000.0
        return obs

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.engine = farkle_core.FarkleEngine(num_players=2)
        return self._get_obs(), {}

    def step(self, action):
        is_bank = action >= 64
        mask = action % 64
        
        # 1. Apply keeps based on mask
        # We only toggle dice that are in 'ROLLED' state and match the mask
        # Actually, let's simplify: the mask represents which of the 6 dice to TRY to keep
        # If a die is already KEPT, we might want to unkeep it? 
        # The TS engine allows unkeeping. 
        # For simplicity in RL, let's say the mask defines the TARGET 'KEPT' state for 'ROLLED' or 'KEPT' dice.
        
        reward = 0
        terminated = False
        truncated = False
        info = {"legal_move": True}

        # Validate and apply keeps
        newly_kept_count = 0
        illegal_action_penalty = 0
        
        # Apply mask: for each bit, if set, try to keep that die
        for i in range(6):
            target_kept = (mask >> i) & 1
            current_state = self.engine.dice[i].state
            
            if target_kept:
                if current_state == farkle_core.DieState.BANKED:
                    illegal_action_penalty += self.illegal_action_penalty
                    info["legal_move"] = False
                elif current_state == farkle_core.DieState.ROLLED:
                    self.engine.toggle_keep(i)
                    if self.engine.dice[i].state == farkle_core.DieState.KEPT:
                        newly_kept_count += 1
                    else:
                        illegal_action_penalty += self.illegal_action_penalty
                        info["legal_move"] = False
            elif not target_kept and current_state == farkle_core.DieState.KEPT:
                self.engine.toggle_keep(i)
        
        # Now perform the action
        points_this_turn = 0
        if is_bank:
            if self.engine.current_keep_score == 0 and self.engine.turn_score == 0:
                reward = -self.illegal_action_penalty
                info["legal_move"] = False
            else:
                points_this_turn = self.engine.turn_score + self.engine.current_keep_score
                self.engine.bank()
                info["turn_points"] = points_this_turn
        else: # ROLL
            # Must keep at least one new scoring die OR all remaining dice are scoring (Hot Hand)
            all_scoring = all(d.state != farkle_core.DieState.ROLLED for d in self.engine.dice)
            if newly_kept_count == 0 and not all_scoring:
                illegal_action_penalty += self.illegal_action_penalty
                info["legal_move"] = False
            
            self.engine.roll()

        reward -= illegal_action_penalty

        # Check for Farkle or Win
        if self.engine.status == farkle_core.GameStatus.FARKLE:
            reward -= 0.5 # Small penalty for farkle
            info["farkle"] = True
            info["turn_points"] = 0
            self.engine.pass_turn() # Move to next player
        elif self.engine.status == farkle_core.GameStatus.WIN:
            reward = 10.0 # Reward for winning
            info["win"] = True
            terminated = True
        
        # Reward for scoring (normalized)
        if points_this_turn > 0:
            reward += points_this_turn / 1000.0

        return self._get_obs(), reward, terminated, truncated, info
