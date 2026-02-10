import pytest
import numpy as np
from api import get_obs_from_state, GameState, Die, PlayerInfo, AgentMove
from unittest.mock import MagicMock

def test_get_obs_from_state_mapping():
    """Verify that WebUI GameState maps correctly to the 16-feature observation vector."""
    dice = [
        Die(id=0, value=1, state="rolled"),
        Die(id=1, value=4, state="rolled"),
        Die(id=2, value=4, state="rolled"),
        Die(id=3, value=5, state="kept"),
        Die(id=4, value=2, state="banked"),
        Die(id=5, value=3, state="banked"),
    ]
    players = [
        PlayerInfo(name="Me", score=1000, isMyTurn=True),
        PlayerInfo(name="Opponent", score=2000, isMyTurn=False)
    ]
    state = GameState(
        message="Test",
        status="rolling",
        turnScore=500,
        currentKeepScore=50,
        dice=dice,
        players=players
    )
    
    obs = get_obs_from_state(state)
    
    assert len(obs) == 16
    # Values / 6.0
    assert obs[0] == pytest.approx(1/6.0)
    assert obs[1] == pytest.approx(4/6.0)
    assert obs[4] == pytest.approx(2/6.0)
    
    # States: rolled=0, kept=1, banked=2. Divided by 2.0
    assert obs[6] == 0.0  # rolled
    assert obs[9] == 0.5  # kept
    assert obs[10] == 1.0 # banked
    
    # Scores / 10000.0
    assert obs[12] == 500 / 10000.0
    assert obs[13] == 50 / 10000.0
    assert obs[14] == 1000 / 10000.0
    assert obs[15] == 2000 / 10000.0

def test_sorting_consistency():
    """Ensure that sorting by ID works regardless of input order from WebUI."""
    dice_unsorted = [
        Die(id=5, value=6, state="rolled"),
        Die(id=0, value=1, state="rolled"),
    ]
    players = [PlayerInfo(name="P", score=0, isMyTurn=True)]
    state = GameState(message="", status="", turnScore=0, currentKeepScore=0, dice=dice_unsorted, players=players)
    
    obs = get_obs_from_state(state)
    assert obs[0] == 1/6.0 # ID 0 value
    assert obs[5] == 6/6.0 # ID 5 value (at index 5 because it's the 6th die position)

def test_failure_point_non_scoring_in_mask():
    """
    FAILURE POINT 1: Model mask includes non-scoring dice.
    WebUI engine will reject this with 'Die with value X is not a scoring die.'
    """
    # Create state where die ID 1 is value 4 (non-scoring)
    dice = [Die(id=i, value=4 if i==1 else 1, state="rolled") for i in range(6)]
    players = [PlayerInfo(name="P", score=0, isMyTurn=True)]
    state = GameState(message="", status="", turnScore=0, currentKeepScore=0, dice=dice, players=players)
    
    # Mock model to return mask 2 (bit 1 set), which keeps die ID 1 (value 4)
    import api
    original_model = api.model
    api.model = MagicMock()
    api.model.predict.return_value = (2, None) # action=2 -> is_bank=False, mask=2
    
    import asyncio
    move = asyncio.run(api.get_move(state))
    
    assert 1 in move.keepDiceIds
    # This proves the API correctly passes the model's intent, 
    # but the intent itself is illegal in WebUI.
    
    api.model = original_model

def test_failure_point_banked_in_mask():
    """
    FAILURE POINT 2: Model mask includes banked dice.
    WebUI engine will reject this.
    """
    dice = [Die(id=i, value=1, state="banked" if i==0 else "rolled") for i in range(6)]
    players = [PlayerInfo(name="P", score=0, isMyTurn=True)]
    state = GameState(message="", status="", turnScore=0, currentKeepScore=0, dice=dice, players=players)
    
    import api
    original_model = api.model
    api.model = MagicMock()
    api.model.predict.return_value = (1, None) # mask=1 -> keep die ID 0
    
    import asyncio
    move = asyncio.run(api.get_move(state))
    
    assert 0 in move.keepDiceIds 
    # Failure detected: API suggests keeping an ALREADY BANKED die.
    
    api.model = original_model

if __name__ == "__main__":
    pytest.main([__file__])
