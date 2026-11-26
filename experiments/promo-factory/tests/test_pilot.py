"""Dependency-free safety and preview tests."""
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

MODULE_PATH = Path(__file__).resolve().parents[1] / "pilot.py"
spec = importlib.util.spec_from_file_location("promo_factory_pilot", MODULE_PATH)
pilot = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(pilot)


class PilotTests(unittest.TestCase):
    def test_default_preview_has_no_actions_or_calls(self):
        state = pilot.preview()
        self.assertEqual(state["model_calls"], 0)
        self.assertEqual(state["external_actions"], "disabled")
        self.assertEqual(len(state["agents"]), 3)

    def test_default_cli_never_builds_director(self):
        with patch.object(sys, "argv", ["pilot.py"]):
            with patch.object(pilot, "build_director", side_effect=AssertionError):
                pilot.main()

    def test_model_mode_requires_explicit_approval(self):
        with patch.object(sys, "argv", ["pilot.py", "--run-model"]):
            with patch.dict("os.environ", {"PROMO_MODEL_APPROVED": ""}):
                with patch.object(pilot, "build_director", side_effect=AssertionError):
                    with self.assertRaises(SystemExit):
                        pilot.main()


if __name__ == "__main__":
    unittest.main()
