"""Small depthwise CNN intended for full INT8 TFLite Micro export."""

from __future__ import annotations

from typing import Any

from aranya_ml.edge.features import EdgeFeatureConfig


def augment_spectrogram(tf: Any, features: Any, label: Any) -> tuple[Any, Any]:
    """Apply training-only time shifts and light feature noise."""
    time_shift = tf.random.uniform((), -3, 4, dtype=tf.int32)
    shifted = tf.roll(features, shift=time_shift, axis=0)
    noise = tf.random.normal(tf.shape(shifted), stddev=0.03, dtype=shifted.dtype)
    return shifted + noise, label


def _depthwise_block(tf: Any, inputs: Any, channels: int, name: str) -> Any:
    layers = tf.keras.layers
    value = layers.DepthwiseConv2D(
        3,
        padding="same",
        use_bias=False,
        name=f"{name}_depthwise",
    )(inputs)
    value = layers.BatchNormalization(name=f"{name}_depthwise_bn")(value)
    value = layers.ReLU(name=f"{name}_depthwise_relu")(value)
    value = layers.Conv2D(
        channels,
        1,
        padding="same",
        use_bias=False,
        name=f"{name}_pointwise",
    )(value)
    value = layers.BatchNormalization(name=f"{name}_pointwise_bn")(value)
    return layers.ReLU(name=f"{name}_pointwise_relu")(value)


def build_edge_dscnn(
    tf: Any,
    config: EdgeFeatureConfig,
    class_count: int,
    feature_mean: float,
    feature_std: float,
    width_multiplier: float = 1.0,
) -> Any:
    """Build a compact single-label environmental sound classifier."""
    if class_count < 2:
        raise ValueError("class_count must be at least two")
    if feature_std <= 0:
        raise ValueError("feature_std must be positive")
    if width_multiplier <= 0:
        raise ValueError("width_multiplier must be positive")
    channels = tuple(max(8, round(value * width_multiplier)) for value in (16, 24, 32, 48))
    layers = tf.keras.layers
    inputs = tf.keras.Input(
        shape=(config.frame_count, config.band_count, 1),
        dtype=tf.float32,
        name="spectral_image",
    )
    value = layers.Rescaling(
        scale=1.0 / feature_std,
        offset=-feature_mean / feature_std,
        name="feature_standardization",
    )(inputs)
    value = layers.Conv2D(
        channels[0],
        3,
        strides=2,
        padding="same",
        use_bias=False,
        name="stem_conv",
    )(value)
    value = layers.BatchNormalization(name="stem_bn")(value)
    value = layers.ReLU(name="stem_relu")(value)
    value = _depthwise_block(tf, value, channels[1], "block_1")
    value = layers.AveragePooling2D(2, name="pool_1")(value)
    value = _depthwise_block(tf, value, channels[2], "block_2")
    value = layers.AveragePooling2D(2, name="pool_2")(value)
    value = _depthwise_block(tf, value, channels[3], "block_3")
    value = layers.Dropout(0.2, name="dropout")(value)
    value = layers.Conv2D(class_count, 1, name="class_logits")(value)
    value = layers.GlobalAveragePooling2D(name="global_average")(value)
    outputs = layers.Activation("softmax", name="class_scores")(value)
    return tf.keras.Model(inputs, outputs, name="aranya_edge_dscnn")
