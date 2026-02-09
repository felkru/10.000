import assert from 'node:assert';
import { evaluateDice, isProofSatisfied } from './gameLogic.js';

console.log("Running Game Logic Tests...");

const test = (name, fn) => {
    try {
        fn();
        console.log(`✅ ${name}`);
    } catch (e) {
        console.error(`❌ ${name} FAILED`);
        console.error(e);
    }
};

// SCORING TESTS
test('Single 1s and 5s', () => {
    const res = evaluateDice([1, 2, 3, 4, 6]);
    assert.strictEqual(res.score, 100);
    assert.deepStrictEqual(res.scoringIndices, [0]);

    const res2 = evaluateDice([5, 2, 3, 4, 6]);
    assert.strictEqual(res2.score, 50);
    assert.deepStrictEqual(res2.scoringIndices, [0]);

    const res3 = evaluateDice([1, 5, 2, 3, 4]);
    assert.strictEqual(res3.score, 150);
});

test('Three of a Kind', () => {
    // 3x 2s = 200
    const res = evaluateDice([2, 2, 2, 3, 4]);
    assert.strictEqual(res.score, 200);
    assert.ok(res.scoringIndices.includes(0));
    assert.ok(res.scoringIndices.includes(1));
    assert.ok(res.scoringIndices.includes(2));

    // 3x 1s = 1000
    const res2 = evaluateDice([1, 1, 1, 3, 4]);
    assert.strictEqual(res2.score, 1000);
});

test('Four of a Kind', () => {
    // 4x 2s = 2000
    const res = evaluateDice([2, 2, 2, 2, 3]);
    assert.strictEqual(res.score, 2000);

    // 4x 1s = Instant Win
    const res2 = evaluateDice([1, 1, 1, 1, 3]);
    assert.strictEqual(res2.score, 10000);
    assert.strictEqual(res2.instantWin, true);
});

test('Combinations', () => {
    // 3x 2s + 1x 1 = 200 + 100 = 300
    const res = evaluateDice([2, 2, 2, 1, 4]);
    assert.strictEqual(res.score, 300);
    assert.strictEqual(res.scoringIndices.length, 4);

    // 3x 2s + 1x 5 = 200 + 50 = 250
    const res2 = evaluateDice([2, 2, 2, 5, 4]);
    assert.strictEqual(res2.score, 250);
});

test('Non-Scoring / Bust potential', () => {
    const res = evaluateDice([2, 3, 4, 6, 2]);
    assert.strictEqual(res.score, 0);
    assert.strictEqual(res.scoringIndices.length, 0);
});

// PROOF RULES
test('Proof Logic', () => {
    // 3x2 (Set) only -> Info: Needs proof
    // but isProofSatisfied returns FALSE if set exists without 1 or 5
    
    assert.strictEqual(isProofSatisfied([2, 2, 2]), false, "3x2 alone should need proof");
    assert.strictEqual(isProofSatisfied([2, 2, 2, 1]), true, "3x2 + 1 should be proved");
    assert.strictEqual(isProofSatisfied([2, 2, 2, 5]), true, "3x2 + 5 should be proved");
    assert.strictEqual(isProofSatisfied([1, 1, 1]), true, "3x1 is its own proof (contains 1)");
    assert.strictEqual(isProofSatisfied([5, 5, 5]), true, "3x5 is its own proof (contains 5)");
    
    // Just 1s and 5s (no set) -> Valid (no proof needed because no set)
    // Actually, isProofSatisfied checks: usage of Set -> requires 1/5.
    // "If you keep a Three of a Kind... you must prove"
    // So if you DON'T keep a set, you don't need proof.
    assert.strictEqual(isProofSatisfied([1, 5]), true, "1s and 5s don't trigger proof need, so true");
    assert.strictEqual(isProofSatisfied([1]), true);
});

console.log("Tests Completed.");
