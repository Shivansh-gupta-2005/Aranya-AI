#include "edge_features.h"

#include <arduinoFFT.h>
#include <cmath>

namespace {
constexpr size_t kFftSize = 256;
constexpr size_t kFrameHop = 240;
float realValues[kFftSize];
float imaginaryValues[kFftSize];
ArduinoFFT<float> fft(realValues, imaginaryValues, kFftSize, 16000.0f);
}

void extractEdgeFeatures(const float* samples, float* features) {
  for (size_t frame = 0; frame < kFeatureFrameCount; ++frame) {
    const size_t offset = frame * kFrameHop;
    for (size_t index = 0; index < kFftSize; ++index) {
      realValues[index] = samples[offset + index];
      imaginaryValues[index] = 0.0f;
    }
    fft.windowing(FFTWindow::Hann, FFTDirection::Forward);
    fft.compute(FFTDirection::Forward);
    fft.complexToMagnitude();
    for (size_t band = 0; band < kFeatureBandCount; ++band) {
      float power = 0.0f;
      for (size_t bin = 0; bin < 4; ++bin) {
        const float magnitude = realValues[band * 4 + bin];
        power += magnitude * magnitude;
      }
      features[frame * kFeatureBandCount + band] = log1pf(power);
    }
  }
}
