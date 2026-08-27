# ARANYA ESP32-S3 firmware

`aranya_node` captures 16 kHz audio from an INMP441, extracts spectral features, runs the INT8 model on the ESP32-S3, confirms repeated events, and posts event metadata over Wi-Fi.

## Configure the node

Copy `aranya_node/config.local.example.h` to `aranya_node/config.local.h`. Set the verified breadboard pins, Wi-Fi credentials, and the laptop's IPv4 address. Git ignores `config.local.h`.

The INMP441 channel-select pin must match the firmware slot. The current firmware reads the left I2S slot.

## Compile

Run from the repository root:

```powershell
& 'C:\Program Files\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe' compile `
  --jobs 8 `
  --fqbn 'esp32:esp32:esp32s3:FlashSize=16M,PartitionScheme=app3M_fat9M_16MB,PSRAM=opi,USBMode=hwcdc' `
  .\firmware\aranya_node
```

Required Arduino libraries:

- Adafruit BME280 Library 2.3.0
- arduinoFFT 2.0.4
- Chirale_TensorFLowLite 2.0.0

## Flash and inspect

Replace `COM6` if the board uses another port:

```powershell
& 'C:\Program Files\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe' upload `
  --port COM6 `
  --fqbn 'esp32:esp32:esp32s3:FlashSize=16M,PartitionScheme=app3M_fat9M_16MB,PSRAM=opi,USBMode=hwcdc' `
  .\firmware\aranya_node

& 'C:\Program Files\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe' monitor `
  --port COM6 `
  --config baudrate=115200
```

Do not treat repeated predictions as valid until the serial log confirms changing microphone input and the configured pins match the breadboard.
