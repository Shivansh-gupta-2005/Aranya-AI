#pragma once

#include <cstddef>

constexpr size_t kAudioSampleCount = 15360;

bool beginAudioCapture();
bool captureAudioWindow(float* samples, size_t count);
