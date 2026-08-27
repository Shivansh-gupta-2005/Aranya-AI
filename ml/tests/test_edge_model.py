import pytest

from aranya_ml.edge.features import DEFAULT_EDGE_FEATURE_CONFIG

tf = pytest.importorskip("tensorflow")

from aranya_ml.edge.model import augment_spectrogram, build_edge_dscnn  # noqa: E402


def test_edge_dscnn_has_six_outputs_and_micro_sized_parameter_count() -> None:
    config = DEFAULT_EDGE_FEATURE_CONFIG

    model = build_edge_dscnn(
        tf,
        config=config,
        class_count=6,
        feature_mean=1.0,
        feature_std=2.0,
    )

    assert model.input_shape == (None, config.frame_count, config.band_count, 1)
    assert model.output_shape == (None, 6)
    assert model.count_params() < 100_000


def test_spectrogram_augmentation_preserves_shape_and_label() -> None:
    features = tf.ones((64, 32, 1), dtype=tf.float32)
    label = tf.constant(3, dtype=tf.int64)

    augmented, augmented_label = augment_spectrogram(tf, features, label)

    assert augmented.shape == features.shape
    assert int(augmented_label.numpy()) == 3
    assert bool(tf.reduce_all(tf.math.is_finite(augmented)).numpy())


def test_edge_dscnn_avoids_arm_only_fully_connected_kernel() -> None:
    model = build_edge_dscnn(
        tf,
        config=DEFAULT_EDGE_FEATURE_CONFIG,
        class_count=6,
        feature_mean=1.0,
        feature_std=2.0,
    )
    converted = tf.lite.TFLiteConverter.from_keras_model(model).convert()
    interpreter = tf.lite.Interpreter(model_content=converted)
    operations = {item["op_name"] for item in interpreter._get_ops_details()}

    assert "FULLY_CONNECTED" not in operations


def test_wider_edge_dscnn_stays_micro_sized() -> None:
    compact = build_edge_dscnn(
        tf,
        config=DEFAULT_EDGE_FEATURE_CONFIG,
        class_count=6,
        feature_mean=1.0,
        feature_std=2.0,
    )
    wider = build_edge_dscnn(
        tf,
        config=DEFAULT_EDGE_FEATURE_CONFIG,
        class_count=6,
        feature_mean=1.0,
        feature_std=2.0,
        width_multiplier=2.0,
    )

    assert wider.output_shape == compact.output_shape
    assert compact.count_params() < wider.count_params() < 100_000
