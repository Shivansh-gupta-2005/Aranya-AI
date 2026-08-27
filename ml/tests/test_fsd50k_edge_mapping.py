from aranya_ml.edge.fsd50k import (
    choose_group_splits,
    classify_fsd_labels,
    is_allowed_license,
)


def test_specific_target_label_maps_to_edge_class() -> None:
    assert classify_fsd_labels(("Drill", "Tools")) == "metal_tool_activity"
    assert classify_fsd_labels(("Fire", "Crackle")) == "fire"
    assert classify_fsd_labels(("Chainsaw", "Tools")) == "chainsaw"


def test_ambiguous_target_labels_are_excluded() -> None:
    assert classify_fsd_labels(("Gunshot_and_gunfire", "Vehicle")) is None


def test_natural_context_maps_to_background_only_without_target() -> None:
    assert classify_fsd_labels(("Bird", "Animal")) == "background"
    assert classify_fsd_labels(("Bird", "Chainsaw")) == "chainsaw"


def test_only_cc0_and_cc_by_licenses_are_allowed() -> None:
    assert is_allowed_license("http://creativecommons.org/publicdomain/zero/1.0/")
    assert is_allowed_license("http://creativecommons.org/licenses/by/4.0/")
    assert not is_allowed_license("http://creativecommons.org/licenses/by-nc/3.0/")
    assert not is_allowed_license("http://creativecommons.org/licenses/sampling+/1.0/")


def test_uploader_groups_use_one_highest_priority_split() -> None:
    rows = [
        ("alice", "train"),
        ("alice", "validation"),
        ("bob", "train"),
        ("carol", "validation"),
        ("carol", "test"),
    ]

    assert choose_group_splits(rows) == {
        "alice": "validation",
        "bob": "train",
        "carol": "test",
    }
