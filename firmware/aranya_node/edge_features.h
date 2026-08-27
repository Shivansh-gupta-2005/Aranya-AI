#pragma once

#include <cstddef>

constexpr size_t kFeatureFrameCount = 64;
constexpr size_t kFeatureBandCount = 32;
constexpr size_t kFeatureCount = kFeatureFrameCount * kFeatureBandCount;

void extractEdgeFeatures(const float* samples, float* features);
