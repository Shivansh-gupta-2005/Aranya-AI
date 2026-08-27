#include "edge_inference.h"

#include <Arduino.h>
#include <Chirale_TensorFlowLite.h>
#include <cmath>
#include <esp_heap_caps.h>

#include "edge_features.h"
#include "model_data.h"
#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"

namespace {
constexpr size_t kTensorArenaSize = 420 * 1024;
uint8_t* tensorArena = nullptr;
const tflite::Model* model = nullptr;
tflite::MicroInterpreter* interpreter = nullptr;
TfLiteTensor* input = nullptr;
TfLiteTensor* output = nullptr;
const char* const classNames[kAranyaClassCount] = {
    "gunfire", "chainsaw_logging", "metal_tool_activity",
    "fire", "vehicle", "background"};
}

bool beginEdgeInference() {
  tensorArena = static_cast<uint8_t*>(
      heap_caps_malloc(kTensorArenaSize, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (tensorArena == nullptr) {
    return false;
  }
  model = tflite::GetModel(kAranyaModel);
  if (model->version() != TFLITE_SCHEMA_VERSION) {
    return false;
  }
  static tflite::MicroMutableOpResolver<7> resolver;
  if (resolver.AddAdd() != kTfLiteOk ||
      resolver.AddAveragePool2D() != kTfLiteOk ||
      resolver.AddConv2D() != kTfLiteOk ||
      resolver.AddDepthwiseConv2D() != kTfLiteOk ||
      resolver.AddMean() != kTfLiteOk || resolver.AddMul() != kTfLiteOk ||
      resolver.AddSoftmax() != kTfLiteOk) {
    return false;
  }
  static tflite::MicroInterpreter staticInterpreter(
      model, resolver, tensorArena, kTensorArenaSize);
  interpreter = &staticInterpreter;
  if (interpreter->AllocateTensors() != kTfLiteOk) {
    return false;
  }
  input = interpreter->input(0);
  output = interpreter->output(0);
  return input->type == kTfLiteInt8 && output->type == kTfLiteInt8 &&
         input->bytes == kFeatureCount;
}

bool runEdgeInference(const float* features, EdgePrediction* prediction) {
  for (size_t index = 0; index < kFeatureCount; ++index) {
    const float quantized = features[index] / input->params.scale + input->params.zero_point;
    input->data.int8[index] = static_cast<int8_t>(roundf(fmaxf(-128.0f, fminf(127.0f, quantized))));
  }
  const unsigned long started = millis();
  if (interpreter->Invoke() != kTfLiteOk) {
    return false;
  }
  prediction->latencyMs = millis() - started;
  prediction->classIndex = 0;
  for (size_t index = 0; index < kAranyaClassCount; ++index) {
    prediction->scores[index] =
        (output->data.int8[index] - output->params.zero_point) * output->params.scale;
    if (prediction->scores[index] > prediction->scores[prediction->classIndex]) {
      prediction->classIndex = index;
    }
  }
  return true;
}

const char* edgeClassName(int classIndex) {
  if (classIndex < 0 || classIndex >= static_cast<int>(kAranyaClassCount)) {
    return "unknown";
  }
  return classNames[classIndex];
}

size_t edgeModelSize() { return kAranyaModelSize; }
