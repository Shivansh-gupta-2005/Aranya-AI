#include "audio_capture.h"

#include <Arduino.h>
#include <ESP_I2S.h>

#include "config.h"

namespace {
I2SClass i2s;
int32_t rawSamples[256];
}

bool beginAudioCapture() {
  i2s.setPins(kI2sBclkPin, kI2sWordSelectPin, -1, kI2sDataPin);
  return i2s.begin(I2S_MODE_STD, 16000, I2S_DATA_BIT_WIDTH_32BIT,
                   I2S_SLOT_MODE_MONO, I2S_STD_SLOT_LEFT);
}

bool captureAudioWindow(float* samples, size_t count) {
  size_t written = 0;
  while (written < count) {
    const size_t wanted = min(sizeof(rawSamples), (count - written) * sizeof(int32_t));
    const size_t received = i2s.readBytes(reinterpret_cast<char*>(rawSamples), wanted);
    if (received == 0) {
      return false;
    }
    const size_t sampleCount = received / sizeof(int32_t);
    for (size_t index = 0; index < sampleCount; ++index) {
      const int32_t sample24 = rawSamples[index] >> 8;
      samples[written++] = static_cast<float>(sample24) / 8388608.0f;
    }
  }
  return true;
}
