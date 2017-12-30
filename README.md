# homebridge-rpi-chacon-thermostat

Manage electric heaters with chacon switches from raspberry pi and arduino DHT sensor.
This implementation of Homekit thermostat is inspired by https://github.com/vietk/homebridge-rpi-chacon, https://github.com/PJCzx/homebridge-thermostat and https://github.com/garc33/hombridge-bluetooth-dht

This plugin uses extensively the WiringPi lib to communicate with GPIO ports of the raspberry. This plugin is compatible with RF433 emitter wired to the Raspberry.