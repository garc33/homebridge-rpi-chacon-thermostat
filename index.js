const SerialPort = require('serialport');
const EventEmitter = require('events');
const chaconEmitter = require('./chaconEmitter');

var Service, Characteristic;

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory("homebridge-thermostat", "Thermostat", Thermostat);
};


function Thermostat(log, config) {
	this.log = log;

	this.maxTemp = config.maxTemp || 30;
	this.minTemp = config.minTemp || 0;
	this.step = config.step || 0.5;
	this.name = config.name;
	this.refreshTime = config.refreshTime || 120000;
	this.deviceId = config.deviceId;
	this.emitterId = config.emitterId;

	this.currentTemperature = 20;
	this.targetTemperature = 20; // value when targetHeatingCoolingState == HEAT
	this.heatingThresholdTemperature = 20; // value when targetHeatingCoolingState == AUTO

	// The value property of CurrentHeatingCoolingState must be one of the following:
	//Characteristic.CurrentHeatingCoolingState.OFF = 0;
	//Characteristic.CurrentHeatingCoolingState.HEAT = 1;
	//Characteristic.CurrentHeatingCoolingState.COOL = 2;
	this.heatingCoolingState = Characteristic.CurrentHeatingCoolingState.AUTO;

	// The value property of TargetHeatingCoolingState must be one of the following:
	//Characteristic.TargetHeatingCoolingState.OFF = 0;
	//Characteristic.TargetHeatingCoolingState.HEAT = 1;
	//Characteristic.TargetHeatingCoolingState.COOL = 2;
	//Characteristic.TargetHeatingCoolingState.AUTO = 3;
	this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;

	this.jsonEmitter = new EventEmitter();

	this.port = new SerialPort(config["port"], {
		parser: SerialPort.parsers.readline('\n')
	});

	setInterval((function () {
		if (!this.port.readable) {
			this.port.open();
		}
	}).bind(this), 1000);

	this.port.on('data', function (data) {
		try {
			jsonEmitter.emit('data', JSON.parse(data));
		} catch (e) {
			this.log('Received invalid JSON : ', e);
		}
	}).bind(this);

	this.shouldTurnOnHeating = function () {
		return (this.targetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.HEAT && this.currentTemperature < this.targetTemperature)
			|| (this.targetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.AUTO && this.currentTemperature < this.heatingThresholdTemperature);
	}.bind(this);

	this.lastUpdateTime = new Date();
	this.updateState = function () {
		if(new Date() - lastUpdateTime < this.refreshTime) {
			return; 
		}
		var order = chaconEmitter.buildOrder(this.emitterId, this.deviceId, this.shouldTurnOnHeating());
		chaconEmitter.transmit(order);
		this.lastUpdateTime = new Date();
	}.bind(this);
}

Thermostat.prototype = {
	getCurrentHeatingCoolingState: function (callback) {
		callback(null, this.currentHeatingCoolingState);
	},
	setCurrentHeatingCoolingState: function (value, callback) {
		this.currentHeatingCoolingState = value;
		callback(null);
	},

	getTargetHeatingCoolingState: function (callback) {
		callback(null, this.targetHeatingCoolingState);
	},
	setTargetHeatingCoolingState: function (value, callback) {
		if (value === undefined) {
			callback(); //Some stuff call this without value doing shit with the rest
		} else {
			this.targetHeatingCoolingState = value;
			callback(null);
		}
	},

	getCurrentTemperature: function (callback) {
		this.jsonEmitter.once('data', (json) => {
			this.currentTemperature = json.temperature;
			callback(null, json.temperature);
		}).bind(this);
	},
	setCurrentTemperature: function (value, callback) {
		callback(null);
	},

	getTargetTemperature: function (callback) {
		callback(null, this.targetTemperature);
	},
	setTargetTemperature: function (value, callback) {
		callback(null);
	},

	getTemperatureDisplayUnits: function (callback) {
		callback(error, Characteristic.TemperatureDisplayUnits.CELSIUS);
	},

	getCurrentRelativeHumidity: function (callback) {
		this.jsonEmitter.once('data', (json) => {
			callback(null, json.humidity);
		});
	},

	getHeatingThresholdTemperature: function (callback) {
		callback(error, this.heatingThresholdTemperature);
	},
	setHeatingThresholdTemperature: function (value, callback) {
		this.heatingThresholdTemperature = value;
	},

	getServices: function () {
		var service = new Service.Thermostat(this.name);
		service
			.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
			.on('get', this.getCurrentHeatingCoolingState.bind(this))
			.on('set', this.setCurrentHeatingCoolingState.bind(this));

		service
			.getCharacteristic(Characteristic.TargetHeatingCoolingState)
			.on('get', this.getTargetHeatingCoolingState.bind(this))
			.on('set', this.setTargetHeatingCoolingState.bind(this));

		service
			.getCharacteristic(Characteristic.CurrentTemperature)
			.on('get', this.getCurrentTemperature.bind(this))
			.on('set', this.setCurrentTemperature.bind(this));

		service
			.getCharacteristic(Characteristic.TargetTemperature)
			.on('get', this.getTargetTemperature.bind(this))
			.on('set', this.setTargetTemperature.bind(this));

		service
			.getCharacteristic(Characteristic.TemperatureDisplayUnits)
			.on('get', this.getTemperatureDisplayUnits.bind(this));

		service
			.getCharacteristic(Characteristic.CurrentRelativeHumidity)
			.on('get', this.getCurrentRelativeHumidity.bind(this));

		service
			.getCharacteristic(Characteristic.HeatingThresholdTemperature)
			.on('get', this.getHeatingThresholdTemperature.bind(this))
			.on('set', this.setHeatingThresholdTemperature.bind(this))
			.setProps({
				minValue: this.minTemp,
				maxValue: this.maxTemp,
				minStep: 0.5
			});
		service.getCharacteristic(Characteristic.CurrentTemperature)
			.setProps({
				minValue: this.minTemp,
				maxValue: this.maxTemp,
				minStep: 0.5
			});
		service.getCharacteristic(Characteristic.TargetTemperature)
			.setProps({
				minValue: this.minTemp,
				maxValue: this.maxTemp,
				minStep: 0.5
			});
		return [service];
	}
};
