import sys
import os
import json
import subprocess

# Add src to sys.path
sys.path.append(os.path.join(os.getcwd(), "src"))
import farkle_core

def test_scoring_parity():
    engine = farkle_core.FarkleEngine()
    
    # Test cases: (values, expected_score)
    test_cases = [
        ([1, 1, 1], 1000),
        ([5, 5, 5], 500),
        ([2, 2, 2], 200),
        ([1, 1, 1, 1], 2000),
        ([1, 1, 1, 1, 1], 4000),
        ([1, 1, 1, 1, 1, 1], 8000),
        ([1, 5], 150),
        ([1, 2, 3, 4, 5, 6], 150), # 1 and 5 score
        ([2, 2, 2, 3, 3, 3], 500), # 200 + 300
    ]
    
    for values, expected in test_cases:
        res = engine.evaluate_scoring(values)
        if res.score != expected:
            print(f"FAIL: {values} expected {expected}, got {res.score}")
        else:
            print(f"PASS: {values} -> {res.score}")

if __name__ == "__main__":
    test_scoring_parity()
