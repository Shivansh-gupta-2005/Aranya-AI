#pragma once

#if __has_include("config.local.h")
#include "config.local.h"
#endif

#ifndef ARANYA_I2S_BCLK_PIN
#define ARANYA_I2S_BCLK_PIN 4
#endif
#ifndef ARANYA_I2S_WORD_SELECT_PIN
#define ARANYA_I2S_WORD_SELECT_PIN 5
#endif
#ifndef ARANYA_I2S_DATA_PIN
#define ARANYA_I2S_DATA_PIN 6
#endif
#ifndef ARANYA_BME_SDA_PIN
#define ARANYA_BME_SDA_PIN 8
#endif
#ifndef ARANYA_BME_SCL_PIN
#define ARANYA_BME_SCL_PIN 9
#endif
#ifndef ARANYA_WIFI_SSID
#define ARANYA_WIFI_SSID "ARANYA_WIFI"
#endif
#ifndef ARANYA_WIFI_PASSWORD
#define ARANYA_WIFI_PASSWORD "CHANGE_ME"
#endif
#ifndef ARANYA_GATEWAY_HOST
#define ARANYA_GATEWAY_HOST "192.168.1.2"
#endif

constexpr int kI2sBclkPin = ARANYA_I2S_BCLK_PIN;
constexpr int kI2sWordSelectPin = ARANYA_I2S_WORD_SELECT_PIN;
constexpr int kI2sDataPin = ARANYA_I2S_DATA_PIN;
constexpr int kBmeSdaPin = ARANYA_BME_SDA_PIN;
constexpr int kBmeSclPin = ARANYA_BME_SCL_PIN;
constexpr char kWifiSsid[] = ARANYA_WIFI_SSID;
constexpr char kWifiPassword[] = ARANYA_WIFI_PASSWORD;
constexpr char kGatewayHost[] = ARANYA_GATEWAY_HOST;
constexpr uint16_t kGatewayPort = 5173;
constexpr char kGatewayPath[] = "/api/events";
constexpr char kNodeId[] = "ARANYA-001";
