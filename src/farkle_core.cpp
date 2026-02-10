#include <vector>
#include <numeric>
#include <algorithm>
#include <random>
#include <map>
#include <string>

enum class DieState { ROLLED, KEPT, BANKED };
enum class GameStatus { ROLLING, FARKLE, BUST, WIN };

struct Die {
    int id;
    int value;
    DieState state;
};

struct ScoringResult {
    int score;
};

class FarkleEngine {
public:
    std::vector<int> player_scores;
    int current_player_index;
    std::vector<Die> dice;
    int turn_score;
    int current_keep_score;
    GameStatus status;
    std::string message;

    FarkleEngine(int num_players = 2) : gen(rd()) {
        player_scores.assign(num_players, 0);
        current_player_index = 0;
        for (int i = 0; i < 6; ++i) {
            dice.push_back({i, 1, DieState::ROLLED});
        }
        turn_score = 0;
        current_keep_score = 0;
        status = GameStatus::ROLLING;
        roll();
    }

    void roll() {
        // 1. Permanentize kept dice
        for (auto& d : dice) {
            if (d.state == DieState::KEPT) {
                d.state = DieState::BANKED;
            }
        }
        turn_score += current_keep_score;
        current_keep_score = 0;

        // 2. Hot Hand check
        bool any_to_roll = false;
        for (const auto& d : dice) {
            if (d.state == DieState::ROLLED) {
                any_to_roll = true;
                break;
            }
        }

        if (!any_to_roll) {
            for (auto& d : dice) d.state = DieState::ROLLED;
        }

        // 3. Roll
        std::uniform_int_distribution<> dis(1, 6);
        std::vector<int> rolled_values;
        for (auto& d : dice) {
            if (d.state == DieState::ROLLED) {
                d.value = dis(gen);
                rolled_values.push_back(d.value);
            }
        }

        // 4. Farkle check
        if (!has_scoring_potential(rolled_values)) {
            status = GameStatus::FARKLE;
            turn_score = 0;
            current_keep_score = 0;
        } else {
            status = GameStatus::ROLLING;
        }
    }

    bool has_scoring_potential(const std::vector<int>& values) {
        std::map<int, int> counts;
        for (int v : values) counts[v]++;
        if (counts[1] > 0 || counts[5] > 0) return true;
        for (auto const& [val, count] : counts) {
            if (count >= 3) return true;
        }
        return false;
    }

    ScoringResult evaluate_scoring(const std::vector<int>& values) {
        std::map<int, int> counts;
        for (int v : values) counts[v]++;
        int score = 0;
        for (int i = 1; i <= 6; ++i) {
            int count = counts[i];
            if (count >= 3) {
                int base = (i == 1 ? 1000 : i * 100);
                score += base * (1 << (count - 3));
                count = 0;
            }
            if (i == 1) score += count * 100;
            if (i == 5) score += count * 50;
        }
        return {score};
    }

    void toggle_keep(int die_id) {
        if (status != GameStatus::ROLLING) return;
        auto it = std::find_if(dice.begin(), dice.end(), [die_id](const Die& d) { return d.id == die_id; });
        if (it == dice.end() || it->state == DieState::BANKED) return;

        if (it->state == DieState::KEPT) {
            // Un-keep all of this value to maintain consistency with TS engine auto-select
            int val = it->value;
            for (auto& d : dice) {
                if (d.value == val && d.state == DieState::KEPT) d.state = DieState::ROLLED;
            }
        } else {
            int val = it->value;
            int count_rolled = 0;
            int count_kept = 0;
            for (const auto& d : dice) {
                if (d.value == val) {
                    if (d.state == DieState::ROLLED) count_rolled++;
                    else if (d.state == DieState::KEPT) count_kept++;
                }
            }

            if (count_rolled + count_kept >= 3) {
                if (count_kept < 3) {
                    int needed = 3 - count_kept;
                    for (auto& d : dice) {
                        if (d.value == val && d.state == DieState::ROLLED && needed > 0) {
                            d.state = DieState::KEPT;
                            needed--;
                        }
                    }
                } else {
                    it->state = DieState::KEPT;
                }
            } else if (val == 1 || val == 5) {
                it->state = DieState::KEPT;
            }
        }
        recalc_keep_score();
    }

    void recalc_keep_score() {
        std::vector<int> kept_values;
        for (const auto& d : dice) {
            if (d.state == DieState::KEPT) kept_values.push_back(d.value);
        }
        current_keep_score = evaluate_scoring(kept_values).score;
    }

    void bank() {
        if (current_keep_score == 0 && turn_score == 0) return;
        turn_score += current_keep_score;
        current_keep_score = 0;
        for (auto& d : dice) {
            if (d.state == DieState::KEPT) d.state = DieState::BANKED;
        }
        player_scores[current_player_index] += turn_score;
        if (player_scores[current_player_index] >= 10000) {
            status = GameStatus::WIN;
        } else {
            pass_turn();
        }
    }

    void pass_turn() {
        turn_score = 0;
        current_keep_score = 0;
        current_player_index = (current_player_index + 1) % player_scores.size();
        for (auto& d : dice) d.state = DieState::ROLLED;
        status = GameStatus::ROLLING;
        roll();
    }

private:
    std::random_device rd;
    std::mt19937 gen;
};
