
export type DieState = 'rolled' | 'kept' | 'banked';

export interface Die {
    id: number;
    value: number;
    state: DieState;
}

export type PlayerType = 'human' | 'computer';

export interface Player {
    id: number;
    type: PlayerType;
    name: string;
    score: number;
}

export type GameStatus = 'rolling' | 'farkle' | 'bust' | 'win';

export class FarkleEngine {
    players: Player[];
    currentPlayerIndex: number;
    dice: Die[];
    turnScore: number; 
    currentKeepScore: number;
    status: GameStatus;
    message: string;

    constructor(playerNames: string[] = ['Player', 'Computer']) {
        this.players = playerNames.map((name, i) => ({
            id: i,
            type: i === 1 ? 'computer' : 'human',
            name,
            score: 0
        }));
        this.currentPlayerIndex = 0;
        this.dice = this.createDice();
        this.turnScore = 0;
        this.currentKeepScore = 0;
        this.status = 'rolling';
        this.message = "Welcome to Farkle! Roll to start.";
    }

    private createDice(): Die[] {
        return Array.from({ length: 6 }, (_, i) => ({
            id: i,
            value: Math.ceil(Math.random() * 6),
            state: 'rolled'
        }));
    }

    getSnapshot() {
        return {
            players: [...this.players],
            currentPlayerIndex: this.currentPlayerIndex,
            dice: [...this.dice], // shallow copy of array, objs are ref but ok for read
            turnScore: this.turnScore,
            currentKeepScore: this.currentKeepScore,
            status: this.status,
            message: this.message
        };
    }

    // --- GAME ACTIONS ---

    roll() {
        // 1. Move 'kept' to 'banked' logic
        const keptDice = this.dice.filter(d => d.state === 'kept');
        if (keptDice.length > 0) {
             // Permanentize them for this turn
             keptDice.forEach(d => d.state = 'banked');
             this.turnScore += this.currentKeepScore;
             this.currentKeepScore = 0;
        }

        // 2. Identify dice to roll
        let diceToRoll = this.dice.filter(d => d.state === 'rolled');

        // Hot Hand Check: If NO dice are 'rolled' (meaning all were kept/banked), reset ALL to roll
        if (diceToRoll.length === 0) {
             // Verify all are banked validly? (Logic guarantees this)
             // Reset all to 'rolled'
             this.dice.forEach(d => d.state = 'rolled');
             diceToRoll = this.dice;
             this.message = "Hot Hand! Rolling all 6 dice!";
        }

        // 3. Roll them
        diceToRoll.forEach(d => {
            d.value = Math.ceil(Math.random() * 6);
        });

        // 4. Check Farkle (Bust)
        // Check if the NEWLY rolled dice have any scoring potential.
        // We simulate "best case" scoring availability.
        const counts = this.getCounts(diceToRoll);
        const hasScore = 
            counts[1] > 0 || 
            counts[5] > 0 || 
            Object.values(counts).some(c => c >= 3);

        if (!hasScore) {
            this.status = 'farkle';
            this.message = "Farkle! No points.";
            this.turnScore = 0;
            this.currentKeepScore = 0;
            // Turn ending must be explicit or auto?
            // Usually auto-end after delay. 
            // We'll leave status as 'farkle' for UI to show, then UI calls endTurn().
        } else {
            this.status = 'rolling';
            this.message = "Select dice to keep.";
        }
    }

    toggleKeep(dieId: number) {
        if (this.status !== 'rolling') return;

        const die = this.dice.find(d => d.id === dieId);
        if (!die || die.state === 'banked') return;

        if (die.state === 'kept') {
             // UN-KEEP (Deselect)
             // If this was part of a Triple, deselect all of that value that are 'kept'
             // BUT, we need to be careful. What if I had 4, kept 3 (as triple), and deselect one?
             // It breaks the triple.
             const val = die.value;
             const keptOfVal = this.dice.filter(d => d.value === val && d.state === 'kept');
             
             // If we unselect one from a group of 3+, unselect count-wise?
             // Simplest approach: Deselect all of that value to avoid partial states.
             keptOfVal.forEach(d => d.state = 'rolled');
        } else {
            // KEEP (Select)
            // Strict Validation: Must be scoring.
            const val = die.value;
            const rolledOfVal = this.dice.filter(d => d.value === val && d.state === 'rolled');
            
            // Check 1: Is it a Triple candidate?
            // If total rolled count of this value >= 3, we MUST select 3.
            if (rolledOfVal.length >= 3) {
                // Select 3 of them
                const toSelect = rolledOfVal.slice(0, 3);
                toSelect.forEach(d => d.state = 'kept');
            } 
            // Check 2: Is it a 1 or 5?
            else if (val === 1 || val === 5) {
                die.state = 'kept';
            }
            // Else: Invalid (Single 2, 3, 4, 6)
            else {
                // Ignore click or flash error?
                // For logic engine, just ignore.
                return;
            }
        }

        this.recalcKeepScore();
    }

    private recalcKeepScore() {
        const keptDice = this.dice.filter(d => d.state === 'kept');
        const { score } = this.evaluateScoring(keptDice);
        this.currentKeepScore = score;
    }

    bank() {
        // Validation
        if (this.currentKeepScore === 0 && this.turnScore === 0) return;
        
        // Finalize current keeps
        this.turnScore += this.currentKeepScore;
        this.currentKeepScore = 0;
        this.dice.filter(d => d.state === 'kept').forEach(d => d.state = 'banked');

        // Update Total
        this.players[this.currentPlayerIndex].score += this.turnScore;
        
        // Win Check
        if (this.players[this.currentPlayerIndex].score >= 10000) {
            this.status = 'win';
            this.message = `${this.players[this.currentPlayerIndex].name} Wins!`;
            return;
        }

        this.passTurn();
    }
    
    passTurn() {
        this.turnScore = 0;
        this.currentKeepScore = 0;
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.message = `${this.players[this.currentPlayerIndex].name}'s Turn`;
        this.dice = this.createDice();
        this.status = 'rolling';
        
        // Let UI trigger computer move if needed
    }

    // --- HELPERS ---

    private getCounts(dice: Die[]): Record<number, number> {
        const counts: Record<number, number> = {};
        dice.forEach(d => counts[d.value] = (counts[d.value] || 0) + 1);
        return counts;
    }

    private evaluateScoring(dice: Die[]): { score: number } {
        const counts = this.getCounts(dice);
        let score = 0;
        
        // Logic: Account for banked dice? 
        // No, 'kept' dice are evaluated in isolation for the current "selection".
        // BUT, if I select 3x2, that's 200.
        // If I select 1x1, that's 100.
        // Total 300.
        // My `toggleKeep` ensures we can only have valid "units" (Sets or Singles).
        // So we can just sum them up.
        
        // Triples
        for (let i = 1; i <= 6; i++) {
            let count = counts[i] || 0;
            // Every group of 3 is a score
            while (count >= 3) {
                score += (i === 1 ? 1000 : i * 100);
                count -= 3;
            }
            // Remaining are singles
            if (i === 1) score += count * 100;
            if (i === 5) score += count * 50;
        }
        
        return { score };
    }
    
    // AI
    computerMove() {
       if (this.status === 'win') return;

       this.roll();
       
       if (this.status === 'farkle') {
           return;
       }
       
       // AI Logic: Keep all scoring dice
       // We can iterate values 1..6.
       // If count >= 3, keeps 3.
       // If 1 or 5, keep.
       
       const rolled = this.dice.filter(d => d.state === 'rolled');
       const counts = this.getCounts(rolled);
       
       // Helper to find IDs
       const findIds = (val: number, count: number): number[] => {
           return rolled.filter(d => d.value === val).slice(0, count).map(d => d.id);
       };

       const idsToKeep: number[] = [];

       for (let i = 1; i <= 6; i++) {
           if ((counts[i] || 0) >= 3) {
               idsToKeep.push(...findIds(i, 3));
               counts[i] -= 3;
               // Check again for 6x?
               if ((counts[i] || 0) >= 3) {
                   idsToKeep.push(...findIds(i, 3)); // Logic needs to pick *different* ids... slice handles this if we refilter?
                   // Actually `findIds` works on implementation. 
                   // `rolled.filter` returns new array. slice(0,3). 
                   // If we call twice, we get same IDs.
                   // BAD.
                   // Simplification: AI keeps MAX scoring.
               }
           }
       }
       // Remaining 1s and 5s
       // We need to exclude IDs already picked?
       // Let's rely on standard loop
       
       // Better AI Loop:
       let available = [...rolled]; // copy
       const aiKeeps: number[] = [];
       
       const pull = (val: number, qty: number) => {
           const found = available.filter(d => d.value === val).slice(0, qty);
           found.forEach(d => {
               aiKeeps.push(d.id);
               // remove from available
               const idx = available.findIndex(x => x.id === d.id);
               if (idx > -1) available.splice(idx, 1);
           });
       };
       
       // 1. Triples
       for (let i = 1; i <= 6; i++) {
           const matches = available.filter(d => d.value === i);
           if (matches.length >= 3) {
               pull(i, 3);
               if (matches.length === 6) pull(i, 3);
           }
       }
       // 2. Singles
       [1, 5].forEach(val => {
           const matches = available.filter(d => d.value === val);
           matches.forEach(() => pull(val, 1));
       });
       
       // Apply
       aiKeeps.forEach(id => {
           const d = this.dice.find(x => x.id === id);
           if (d) d.state = 'kept';
       });
       
       this.recalcKeepScore();
       
       this.recalcKeepScore();
       
       // Bank handled by UI
    }
}
