import torch
import torch.nn as nn
import torch.optim as optim
from torch.distributions import Categorical
import numpy as np

class ActorCritic(nn.Module):
    def __init__(self, input_dim, action_dim):
        super(ActorCritic, self).__init__()
        self.fc1 = nn.Linear(input_dim, 256)
        self.fc2 = nn.Linear(256, 128)
        
        # Policy Head
        self.actor = nn.Linear(128, action_dim)
        
        # Value Head
        self.critic = nn.Linear(128, 1) # Value of state V(s)
        
        self.activation = nn.ReLU()
        
    def forward(self, state, action_mask=None):
        x = self.activation(self.fc1(state))
        x = self.activation(self.fc2(x))
        
        # Actor
        logits = self.actor(x)
        if action_mask is not None:
            # Mask invalid actions with -inf
            # mask is 1 for valid, 0 for invalid.
            # We want to set 0s to -inf.
            # Convert mask to boolean or float
            # Assumes action_mask is Float [Batch, 64] with 1.0 or 0.0
            inf_mask = (1.0 - action_mask) * -1e9
            logits = logits + inf_mask

        probs = torch.softmax(logits, dim=-1)
        dist = Categorical(probs)
        
        # Critic
        value = self.critic(x)
        
        return dist, value

class PPOAgent:
    def __init__(self, input_dim, action_dim, lr=3e-4, gamma=0.99, eps_clip=0.2, k_epochs=4):
        self.policy = ActorCritic(input_dim, action_dim)
        self.optimizer = optim.Adam(self.policy.parameters(), lr=lr)
        self.gamma = gamma
        self.eps_clip = eps_clip
        self.k_epochs = k_epochs
        
        self.buffer = []
        
    def select_action(self, state, mask):
        state = torch.FloatTensor(state).unsqueeze(0)
        mask = torch.FloatTensor(mask).unsqueeze(0)
        
        dist, value = self.policy(state, mask)
        action = dist.sample()
        log_prob = dist.log_prob(action)
        
        return action.item(), log_prob.item(), value.item()

    def store_transition(self, transition):
        # state, action, log_prob, reward, done, mask, value
        self.buffer.append(transition)

    def finish_game(self, reward):
        # Backfill rewards for the collected trajectory of this episode
        # But wait, self-play involves strictly alternating turns or episodes?
        # A buffer usually holds (s, a, logp, r, done) for many steps.
        # But in sparse reward game, 'r' is 0 until end.
        # We need to compute discounted returns.
        pass

    def update(self):
        if not self.buffer:
            return
            
        # Convert buffer to tensors
        states = torch.FloatTensor(np.array([t[0] for t in self.buffer]))
        actions = torch.LongTensor(np.array([t[1] for t in self.buffer]))
        old_log_probs = torch.FloatTensor(np.array([t[2] for t in self.buffer]))
        rewards = [t[3] for t in self.buffer]
        dones = [t[4] for t in self.buffer]
        masks = torch.FloatTensor(np.array([t[5] for t in self.buffer]))
        values = torch.FloatTensor(np.array([t[6] for t in self.buffer])) # Not strictly needed for returns calculation
        
        # Monte Carlo estimate of returns
        returns = []
        discounted_sum = 0
        for reward, is_done in zip(reversed(rewards), reversed(dones)):
            if is_done:
                discounted_sum = 0
            discounted_sum = reward + (self.gamma * discounted_sum)
            returns.insert(0, discounted_sum)
            
        returns = torch.FloatTensor(returns)
        
        # Normalizing the returns
        returns = (returns - returns.mean()) / (returns.std() + 1e-7)
        
        # Optimization steps
        for _ in range(self.k_epochs):
            # Evaluating old actions and values
            dist, state_values = self.policy(states, masks)
            state_values = state_values.squeeze()
            log_probs = dist.log_prob(actions)
            dist_entropy = dist.entropy()
            
            # Ratios
            ratios = torch.exp(log_probs - old_log_probs)
            
            # Advantages
            advantages = returns - state_values.detach()
            
            # Surrogate Loss
            surr1 = ratios * advantages
            surr2 = torch.clamp(ratios, 1 - self.eps_clip, 1 + self.eps_clip) * advantages
            
            loss = -torch.min(surr1, surr2) + 0.5 * nn.MSELoss()(state_values, returns) - 0.01 * dist_entropy
            
            self.optimizer.zero_grad()
            loss.mean().backward()
            self.optimizer.step()
            
        self.buffer = []

    def save(self, path):
        torch.save(self.policy.state_dict(), path)
        
    def load(self, path):
        self.policy.load_state_dict(torch.load(path))
