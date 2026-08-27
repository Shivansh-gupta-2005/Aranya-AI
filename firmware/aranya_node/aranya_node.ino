#include <Adafruit_BME280.h>
#include <Arduino.h>
#include <Wire.h>

#include "audio_capture.h"
#include "config.h"
#include "edge_features.h"
#include "edge_inference.h"
#include "event_sender.h"

namespace {
float audioSamples[kAudioSampleCount];
float features[kFeatureCount];
Adafruit_BME280 bme;
bool bmeReady = false;
int pendingClass = -1;
int pendingCount = 0;
constexpr int kBackgroundIndex = 5;
constexpr int kConfirmationWindows = 2;
}

void stopWithError(const char* message) {
  Serial.println(message);
  while (true) {
    delay(1000);
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("ARANYA edge node starting");
  if (!beginAudioCapture()) {
    stopWithError("audio_init=failed");
  }
  if (!beginEdgeInference()) {
    stopWithError("model_init=failed");
  }
  Wire.begin(kBmeSdaPin, kBmeSclPin);
  bmeReady = bme.begin(0x76) || bme.begin(0x77);
  Serial.printf("bme=%s\n", bmeReady ? "ok" : "missing");
  Serial.printf("wifi=%s\n", beginEventSender() ? "ok" : "offline");
  Serial.printf("model_bytes=%u\n", static_cast<unsigned>(edgeModelSize()));
}

void loop() {
  if (!captureAudioWindow(audioSamples, kAudioSampleCount)) {
    Serial.println("audio_capture=failed");
    return;
  }
  extractEdgeFeatures(audioSamples, features);
  EdgePrediction prediction{};
  if (!runEdgeInference(features, &prediction)) {
    Serial.println("inference=failed");
    return;
  }
  const float confidence = prediction.scores[prediction.classIndex];
  Serial.printf("class=%s confidence=%.4f inference_ms=%lu\n",
                edgeClassName(prediction.classIndex), confidence,
                prediction.latencyMs);
  if (prediction.classIndex == kBackgroundIndex) {
    pendingClass = -1;
    pendingCount = 0;
    return;
  }
  if (pendingClass == prediction.classIndex) {
    ++pendingCount;
  } else {
    pendingClass = prediction.classIndex;
    pendingCount = 1;
  }
  if (pendingCount < kConfirmationWindows) {
    return;
  }
  const float temperature = bmeReady ? bme.readTemperature() : NAN;
  const float humidity = bmeReady ? bme.readHumidity() : NAN;
  const bool sent = sendEvent(edgeClassName(prediction.classIndex), confidence,
                              temperature, humidity, prediction.latencyMs);
  Serial.printf("event_send=%s\n", sent ? "ok" : "failed");
  pendingCount = 0;
}
