#pragma once

bool beginEventSender();
bool sendEvent(const char* eventClass, float confidence, float temperatureC,
               float humidity, unsigned long inferenceMs);
