#include "event_sender.h"

#include <Arduino.h>
#include <WiFi.h>

#include "config.h"

bool beginEventSender() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(kWifiSsid, kWifiPassword);
  const unsigned long deadline = millis() + 15000;
  while (WiFi.status() != WL_CONNECTED && millis() < deadline) {
    delay(250);
  }
  return WiFi.status() == WL_CONNECTED;
}

bool sendEvent(const char* eventClass, float confidence, float temperatureC,
               float humidity, unsigned long inferenceMs) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  char body[384];
  const int bodyLength = snprintf(
      body, sizeof(body),
      "{\"node_id\":\"%s\",\"event_class\":\"%s\",\"confidence\":%.4f,"
      "\"temperature_c\":%.2f,\"humidity\":%.2f,\"model\":\"aranya-edge-dscnn\","
      "\"inference_ms\":%lu}",
      kNodeId, eventClass, confidence, temperatureC, humidity, inferenceMs);
  if (bodyLength <= 0 || bodyLength >= static_cast<int>(sizeof(body))) {
    return false;
  }
  WiFiClient client;
  if (!client.connect(kGatewayHost, kGatewayPort)) {
    return false;
  }
  client.printf("POST %s HTTP/1.1\r\n", kGatewayPath);
  client.printf("Host: %s:%u\r\n", kGatewayHost, kGatewayPort);
  client.print("Content-Type: application/json\r\nConnection: close\r\n");
  client.printf("Content-Length: %d\r\n\r\n", bodyLength);
  client.write(reinterpret_cast<const uint8_t*>(body), bodyLength);
  client.stop();
  return true;
}
