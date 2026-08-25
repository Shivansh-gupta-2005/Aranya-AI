from pytest import CaptureFixture

from aranya_ml.cli.main import main


def test_validate_catalog_command(capsys: CaptureFixture[str]) -> None:
    exit_code = main(["validate-catalog", "--catalog", "datasets/v1"])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Valid recordings: 13" in captured.out
    assert "Training eligible: 0" in captured.out


def test_gated_command_explains_missing_input(capsys: CaptureFixture[str]) -> None:
    exit_code = main(["train", "--catalog", "datasets/v1"])

    captured = capsys.readouterr()
    assert exit_code == 2
    assert "No training-eligible recordings" in captured.err
