import torch
import numpy as np
from src.env import ZehntausendEnv
from src.agent import PPOAgent
import os

def train():
    env = ZehntausendEnv()
    state_dim = 10
    action_dim = 64
    
    agent = PPOAgent(state_dim, action_dim)
    
    # Configuration
    CHECKPOINT_PATH = None # Set to "checkpoints/ppo_zehntausend_XXXX.pth" to resume
    # CHECKPOINT_PATH = "checkpoints/ppo_zehntausend_2000.pth" 
    
    start_episode = 0
    if CHECKPOINT_PATH and os.path.exists(CHECKPOINT_PATH):
        print(f"Loading checkpoint from {CHECKPOINT_PATH}")
        agent.load(CHECKPOINT_PATH)
        # Verify if we can extract episode number
        import re
        match = re.search(r"ppo_zehntausend_(\d+).pth", CHECKPOINT_PATH)
        if match:
            start_episode = int(match.group(1))
            print(f"Resuming from episode {start_episode}")
    else:
        print("Starting training from scratch.")

    max_episodes = 10000 
    update_timestep = 2000 
    
    # Ensure checkpoints dir exists
    os.makedirs("checkpoints", exist_ok=True)
    
    print("Starting training...")
    
    all_rewards = []
    
    for i_episode in range(start_episode + 1, max_episodes + 1):
        state = env.reset()
        current_player = env.game.current_player
        
        # Temporary buffers for the two players in this episode
        # List of (state, action, log_prob, mask, value)
        p1_trace = []
        p2_trace = []
        
        step_count = 0
        done = False
        
        while not done:
            step_count += 1
            mask = env.get_legal_actions()
            
            action, log_prob, value = agent.select_action(state, mask)
            
            # Record move for current player
            # Note: Store (state, action, log_prob, mask, value)
            # Reward will be assigned at end.
            
            current_trace = p1_trace if env.game.current_player == 0 else p2_trace
            current_trace.append((state, action, log_prob, mask, value))
            
            next_state, reward, done, _ = env.step(action)
            
            if done:
                # Game Over.
                # calculate final rewards.
                # reward from step() is usually for the WINNER.
                # If step() returns +1 (and typically it does if Current Player won),
                # Then Current Player gets +1. Opponent gets -1.
                # Wait, step() returns dense rewards too?
                # My Env currently returns `points/10000 + 1.0` if won.
                # This is positive for winner.
                # What about loser?
                # Loser didn't make the last move?
                # Actually, the last move was by the Winner (who Banked).
                # So P1 wins. P1 trace gets high reward. P2 trace gets low/negative?
                # P2 just lost.
                
                # Assign rewards:
                # Winner: +1. Loser: -1.
                # Let's discard dense rewards for now to rely on pure Win/Loss
                # Or keep dense intermediate, but final boost.
                
                winner = env.game.winner
                
                # Backprop rewards
                # For P1:
                r_p1 = 1 if winner == 0 else -1
                # For P2:
                r_p2 = 1 if winner == 1 else -1
                
                # Build transitions for global buffer
                # Trajectory: stored (s, a, lp, m, v)
                # Need (s, a, lp, r, d, m, v)
                
                # Simple approach: Give final reward to LAST step?
                # And 0 to others? Or discounted?
                # PPO update uses 'rewards' list to compute discounted return.
                # So we create a list of rewards [0, 0, ..., FinalReward].
                # Or if using dense rewards [r1, r2, ... rN + Final].
                
                # I'll stick to Sparse Win/Loss for "Superhuman" (AlphaZero style), 
                # but PPO likes dense. I'll use simple +1/-1 at end.
                
                # P1
                for idx, t in enumerate(p1_trace):
                    r = 0
                    d = False
                    if idx == len(p1_trace) - 1:
                        r = r_p1
                        d = True
                    agent.store_transition((t[0], t[1], t[2], r, d, t[3], t[4]))
                    
                # P2
                for idx, t in enumerate(p2_trace):
                    r = 0
                    d = False
                    if idx == len(p2_trace) - 1:
                        r = r_p2
                        d = True
                    agent.store_transition((t[0], t[1], t[2], r, d, t[3], t[4]))
                    
                all_rewards.append(len(p1_trace) + len(p2_trace)) # Length of game
                
            else:
                state = next_state
        
        # Periodic update
        if i_episode % 20 == 0:
            agent.update()
            avg_len = np.mean(all_rewards[-20:])
            print(f"Episode {i_episode}: Update. Avg Game Length: {avg_len:.1f} steps.")
            
        if i_episode % 500 == 0:
            agent.save(f"checkpoints/ppo_zehntausend_{i_episode}.pth")
            
    # Save log
    np.save("training_lengths.npy", all_rewards)

if __name__ == '__main__':
    train()
