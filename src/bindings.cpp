#include "farkle_core.cpp"
#include <pybind11/pybind11.h>
#include <pybind11/stl.h>

namespace py = pybind11;

PYBIND11_MODULE(farkle_core, m) {
  py::enum_<DieState>(m, "DieState")
      .value("ROLLED", DieState::ROLLED)
      .value("KEPT", DieState::KEPT)
      .value("BANKED", DieState::BANKED)
      .export_values();

  py::enum_<GameStatus>(m, "GameStatus")
      .value("ROLLING", GameStatus::ROLLING)
      .value("FARKLE", GameStatus::FARKLE)
      .value("BUST", GameStatus::BUST)
      .value("WIN", GameStatus::WIN)
      .export_values();

  py::class_<Die>(m, "Die")
      .def_readwrite("id", &Die::id)
      .def_readwrite("value", &Die::value)
      .def_readwrite("state", &Die::state);

  py::class_<FarkleEngine>(m, "FarkleEngine")
      .def(py::init<int>(), py::arg("num_players") = 2)
      .def_readwrite("player_scores", &FarkleEngine::player_scores)
      .def_readwrite("current_player_index",
                     &FarkleEngine::current_player_index)
      .def_readwrite("dice", &FarkleEngine::dice)
      .def_readwrite("turn_score", &FarkleEngine::turn_score)
      .def_readwrite("current_keep_score", &FarkleEngine::current_keep_score)
      .def_readwrite("status", &FarkleEngine::status)
      .def_readwrite("message", &FarkleEngine::message)
      .def("roll", &FarkleEngine::roll)
      .def("toggle_keep", &FarkleEngine::toggle_keep)
      .def("bank", &FarkleEngine::bank)
      .def("pass_turn", &FarkleEngine::pass_turn)
      .def("recalc_keep_score", &FarkleEngine::recalc_keep_score)
      .def("evaluate_scoring", [](FarkleEngine &self, std::vector<int> values) {
        return self.evaluate_scoring(values).score;
      });
}
