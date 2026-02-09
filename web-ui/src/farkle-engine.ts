
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
        this.dice = Array.from({ length: 6 }, (_, i) => ({
            id: i,
            value: 1, // Placeholder
            state: 'rolled'
        }));
        this.turnScore = 0;
        this.currentKeepScore = 0;
        this.status = 'rolling';
        // Trigger initial roll for the first player
        this.roll();
        this.message = "Welcome to Farkle! Your turn.";
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
             const val = die.value;
             const keptOfVal = this.dice.filter(d => d.value === val && d.state === 'kept');
             keptOfVal.forEach(d => d.state = 'rolled');
        } else {
            // KEEP (Select)
            const val = die.value;
            const rolledOfVal = this.dice.filter(d => d.value === val && d.state === 'rolled');
            const keptOfVal = this.dice.filter(d => d.value === val && d.state === 'kept');
            
            // Check 1: Is it part of a set >= 3?
            if (rolledOfVal.length + keptOfVal.length >= 3) {
                 // It contributes to a set.
                 // If we have less than 3 kept, we should probably select enough to make 3 first?
                 // Or just select this one?
                 // Current UX: "Selecting one die of a triple will auto-select the others."
                 
                 // Strategy:
                 // If kept < 3, select up to 3 (or all rolled if total < 3? No, total is >=3).
                 // If kept >= 3, just select this one.
                 
                 if (keptOfVal.length < 3) {
                     // Auto-select needed to form at least 3
                     // We need (3 - kept) more.
                     const needed = 3 - keptOfVal.length;
                     // We prefer to select the clicked one + others
                     const others = rolledOfVal.filter(d => d.id !== dieId);
                     const toSelect = [die, ...others].slice(0, needed);
                     
                     // Wait, if I have 4 rolled, and I click one. kept=0. needed=3.
                     // I select clicked + 2 others. Total 3 kept. 1 rolled.
                     // Correct.
                     toSelect.forEach(d => d.state = 'kept');
                 } else {
                     // Already have 3+, adding another doubles score
                     die.state = 'kept';
                 }
            }
            // Check 2: Is it a 1 or 5?
            else if (val === 1 || val === 5) {
                die.state = 'kept';
            }
            // Else: Invalid
            else {
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
        
        // Reset dice state to 'rolled' so they can be rolled
        this.dice.forEach(d => d.state = 'rolled');
        this.status = 'rolling';
        
        // Auto-roll for the new player
        this.roll();
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
        
        // Triples and Doubling Rule
        for (let i = 1; i <= 6; i++) {
            let count = counts[i] || 0;
            
            if (count >= 3) {
                // Base score for 3 dice
                let base = (i === 1 ? 1000 : i * 100);
                
                // Doubling for each die beyond 3
                // 3 dice: base * 2^0
                // 4 dice: base * 2^1
                // 5 dice: base * 2^2
                // 6 dice: base * 2^3
                let multiplier = 1 << (count - 3); // 2^(count-3)
                score += base * multiplier;
                
                // All dice of this value are consumed by the set
                count = 0;
            }
            
            // Remaining are singles (only relevant if count < 3, i.e., 1s and 5s)
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
       // With doubling rule, keeping 4, 5, 6 of a kind is always better.
       
       const rolled = this.dice.filter(d => d.state === 'rolled');
       const counts = this.getCounts(rolled);
       const aiKeeps: number[] = [];
       
       const findIds = (val: number): number[] => {
            return rolled.filter(d => d.value === val).map(d => d.id);
       };

       for (let i = 1; i <= 6; i++) {
           const count = counts[i] || 0;
           if (count >= 3) {
               // Keep ALL of them
               aiKeeps.push(...findIds(i));
               counts[i] = 0; // Consumed
           }
       }
       
       // Singles
       [1, 5].forEach(val => {
           if (counts[val] > 0) {
                aiKeeps.push(...findIds(val)); 
           }
       });
       
       // Apply
       aiKeeps.forEach(id => {
           const d = this.dice.find(x => x.id === id);
           if (d) d.state = 'kept';
       });
       
       this.recalcKeepScore();
       
       // Bank handled by UI
    }
}
