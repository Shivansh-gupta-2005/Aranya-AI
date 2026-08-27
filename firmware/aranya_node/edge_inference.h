#pragma once

#include <cstddef>

constexpr size_t kAranyaClassCount = 6;

struct EdgePrediction {
  int classIndex;
  float scores[kAranyaClassCount];
  unsigned long latencyMs;
};

bool beginEdgeInference();
bool runEdgeInference(const float* features, EdgePrediction* prediction);
const char* edgeClassName(int classIndex);
size_t edgeModelSize();
