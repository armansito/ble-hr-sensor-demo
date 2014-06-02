// GATT Heart Rate Service UUIDs
var HEART_RATE_SERVICE_UUID            = '0000180d-0000-1000-8000-00805f9b34fb';
var HEART_RATE_MEASUREMENT_CHRC_UUID   = '00002a37-0000-1000-8000-00805f9b34fb';
var BODY_SENSOR_LOCATION_CHRC_UUID     = '00002a38-0000-1000-8000-00805f9b34fb';
var HEART_RATE_CONTROL_POINT_CHRC_UUID = '00002a39-0000-1000-8000-00805f9b34fb';

// The currently displayed service and characteristics.
var heartRateService;
var heartRateMeasurementCharacteristic;
var totalEnergyExpanded;

// A mapping from device addresses to device names for found devices that expose
// a Heart Rate service.
var heartRateDevicesMap = {};

/**
 * Updates the UI based on the selected service.
 * @param {chrome.bluetoothLowEnergy.Service} service The selected GATT service
 *     to display.
 */
function selectService(service) {
  // Hide or show the appropriate elements based on whether or not
  // |serviceId| is undefined.
  document.getElementById('no-devices-error').hidden = !!service;
  document.getElementById('heart-rate-fields').hidden = !service;

  clearAllFields();

  heartRateService = service;
  heartRateMeasurementCharacteristic = undefined;
  if (!service) {
    console.log('No service selected.');
    return;
  }

  console.log('GATT service selected: ' + service.instanceId);

  // Get the characteristics of the selected service.
  chrome.bluetoothLowEnergy.getCharacteristics(service.instanceId,
                                               function (chrcs) {
    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError.message);
      return;
    }

    // Make sure that the same service is still selected.
    if (service.instanceId != heartRateService.instanceId)
      return;

    if (chrcs.length == 0) {
      console.log('Service has no characteristics: ' + service.instanceId);
      return;
    }

    chrcs.forEach(function (chrc) {
      if (chrc.uuid == HEART_RATE_MEASUREMENT_CHRC_UUID) {
        console.log('Setting Heart Rate Measurement Characteristic: ' +
                    chrc.instanceId);
        heartRateMeasurementCharacteristic = chrc;
        updateHeartRateMeasurementValue();
        return;
      }
    });
  });
}

/**
 * Updates the Heart Rate Measurement fields based on the value of the currently
 * selected Heart Rate Measurement Characteristic.
 */
function updateHeartRateMeasurementValue() {
  if (!heartRateMeasurementCharacteristic) {
    console.log('No Heart Rate Measurement Characteristic selected');
    return;
  }

  // The Heart Rate Measurement Characteristic does not allow 'read' operations
  // and its value can only be obtained via notifications, so the |value| field
  // might be undefined here.
  if (!heartRateMeasurementCharacteristic.value) {
    console.log('No Heart Rate Measurement value received yet');
    return;
  }

  var valueBytes = new Uint8Array(heartRateMeasurementCharacteristic.value);
  if (valueBytes < 2) {
    console.log('Invalid Heart Rate Measurement value');
    return;
  }

  // The first byte is the flags field.
  var flags = valueBytes[0];

  // The least significant bit is the Heart Rate Value format. If 0, the heart
  // rate measurement is expressed in the next byte of the value. If 1, it is a
  // 16 bit value expressed in the next two bytes of the value.
  var hrFormat = flags & 0x01;

  // The next two bits is the Sensor Contact Status.
  var sensorContactStatus = (flags >> 1) & 0x03;

  // The next bit is the Energy Expanded Status. If 1, the Energy Expanded field
  // is present in the characteristic value.
  var eeStatus = (flags >> 3) & 0x01;

  // The next bit is the RR-Interval bit. If 1, RR-Interval values are present.
  var rrBit = (flags >> 4) & 0x01;

  var heartRateMeasurement;
  var energyExpanded;
  var rrInterval;
  var minLength = hrFormat == 1 ? 3 : 2;
  if (valueBytes.length < minLength) {
    console.log('Invalid Heart Rate Measurement value');
    return;
  }

  if (hrFormat == 0) {
    console.log('8-bit Heart Rate format');
    heartRateMeasurement = valueBytes[1];
  } else {
    console.log('16-bit Heart Rate format');
    heartRateMeasurement = valueBytes[1] | (valueBytes[2] << 8);
  }

  var nextByte = minLength;
  if (eeStatus == 1) {
    if (valueBytes.length < nextByte + 2) {
      console.log('Invalid value for "Energy Expanded"');
      return;
    }

    console.log('Energy Expanded field present');
    energyExpanded = valueBytes[nextByte] | (valueBytes[nextByte + 1] << 8);
    nextByte += 2;
  }

  if (rrBit == 1) {
    if (valueBytes.length != nextByte + 2) {
      console.log('Invalid value for "RR-Interval"');
      return;
    }

    console.log('RR-Interval field present');

    // Note: According to the specification, there can be several RR-Interval
    // values in a characteristic value, however we're just picking the first
    // one here for demo purposes.
    rrInterval = valueBytes[nextByte] | (valueBytes[nextByte + 1] << 8);
  }

  setHeartRateMeasurement(heartRateMeasurement);
  setSensorContactStatus((function() {
    switch (sensorContactStatus) {
    case 0:
    case 1:
      return 'not supported';
    case 2:
      return 'contact not detected';
    case 3:
      return 'contact detected';
    default:
      return;
    }
  })());

  if (energyExpanded !== undefined)
      totalEnergyExpanded = energyExpanded;

  setEnergyExpanded(totalEnergyExpanded);
  setRRInterval(rrInterval);
}

/**
 * Helper functions to set the values of Heart Rate UI fields.
 */
function setFieldValue(id, value) {
  var div = document.getElementById(id);
  div.innerHTML = '';
  div.appendChild(document.createTextNode((value === undefined) ? '-' : value));
}

function setHeartRateMeasurement(value) {
  setFieldValue('heart-rate-measurement', value);
}

function setSensorContactStatus(value) {
  setFieldValue('sensor-contact-status', value);
}

function setEnergyExpanded(value) {
  setFieldValue('energy-expanded', value);
}

function setRRInterval(value) {
  setFieldValue('rr-interval', value);
}

function setBodySensorLocation(value) {
  setFieldValue('body-sensor-location', value);
}

function clearAllFields() {
  setHeartRateMeasurement(undefined);
  setSensorContactStatus(undefined);
  setEnergyExpanded(undefined);
  setRRInterval(undefined);
  setBodySensorLocation(undefined);
}

/**
 * Updates the dropdown menu based on the contents of |heartRateDevicesMap|.
 */
function updateDeviceSelector() {
  var deviceSelector = document.getElementById('device-selector');
  var placeHolder = document.getElementById('placeholder');
  var addresses = Object.keys(heartRateDevicesMap);

  // Clear the drop-down menu.
  if (addresses.length == 0) {
    console.log('No heart rate devices found');
    deviceSelector.innerHTML = '';
    placeHolder.innerHTML = '';
    placeHolder.appendChild(document.createTextNode('No connected devices'));
    placeHolder.hidden = false;
    deviceSelector.appendChild(placeHolder);
    return;
  }

  // Hide the placeholder and populate
  placeHolder.innerHTML = '';
  placeHolder.appendChild(document.createTextNode('Connected devices found'));

  for (var i = 0; i < addresses.length; i++) {
    var address = addresses[i];
    var deviceOption = document.createElement('option');
    deviceOption.setAttribute('value', address);
    deviceOption.appendChild(document.createTextNode(
        heartRateDevicesMap[address]));
    deviceSelector.appendChild(deviceOption);
  }
}

/**
 * This is the entry point of the application. Initialize UI state and set up
 * the relevant Bluetooth Low Energy event listeners.
 */
function main() {
  // Set up the UI to look like no device was initially selected.
  selectService(undefined);

  // Initialize |heartRateDevicesMap|.
  chrome.bluetooth.getDevices(function (devices) {
    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError.message);
    }

    if (devices) {
      devices.forEach(function (device) {
        // See if the device exposes a Heart Rate service.
        chrome.bluetoothLowEnergy.getServices(device.address,
                                              function (services) {
          if (chrome.runtime.lastError) {
            console.log(chrome.runtime.lastError.message);
            return;
          }

          if (!services)
            return;

          var found = false;
          services.forEach(function (service) {
            if (service.uuid == HEART_RATE_SERVICE_UUID) {
              console.log('Found Heart Rate service!');
              found = true;
            }
          });

          if (!found)
            return;

          console.log('Found device with Heart Rate service: ' +
                      device.address);
          heartRateDevicesMap[device.address] =
              (device.name ? device.name : device.address);

          updateDeviceSelector();
        });
      });
    }
  });

  // Set up the device selector.
  var deviceSelector = document.getElementById('device-selector');
  deviceSelector.onchange = function () {
    var selectedValue = deviceSelector[deviceSelector.selectedIndex].value;

    // If |selectedValue| is empty, unselect everything.
    if (!selectedValue) {
      selectService(undefined);
      return;
    }

    // Request all GATT services of the selected device to see if it still has
    // a Heart Rate service and pick the first Heart Rate service to display.
    chrome.bluetoothLowEnergy.getServices(selectedValue, function (services) {
      if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError.message);
        selectService(undefined);
        return;
      }

      var foundService = undefined;
      services.forEach(function (service) {
        if (service.uuid == HEART_RATE_SERVICE_UUID)
          foundService = service;
      });

      selectService(foundService);
    });
  };

  // TODO: set up service and characteristic events.
  // Track GATT services as they are added.
  chrome.bluetoothLowEnergy.onServiceAdded.addListener(function (service) {
    // Ignore, if the service is not a Heart Rate service.
    if (service.uuid != HEART_RATE_SERVICE_UUID)
      return;

    // Add the device of the service to the device map and update the UI.
    console.log('New Heart Rate service added: ' + service.instanceId);
    if (heartRateDevicesMap.hasOwnProperty(service.deviceAddress))
      return;

    // Looks like it's a brand new device. Get information about the device so
    // that we can display the device name in the drop-down menu.
    chrome.bluetooth.getDevice(service.deviceAddress, function (device) {
      if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError.message);
        return;
      }

      heartRateDevicesMap[device.address] =
          (device.name ? device.name : device.address);
      updateDeviceSelector();
    });
  });

  // Track GATT services as they are removed.
  chrome.bluetoothLowEnergy.onServiceRemoved.addListener(function (service) {
    console.log('foo');
    // Ignore, if the service is not a Heart Rate service.
    if (service.uuid != HEART_RATE_SERVICE_UUID)
      return;

    // See if this is the currently selected service. If so, unselect it.
    console.log('Heart Rate service removed: ' + service.instanceId);
    if (heartRateService && heartRateService.instanceId == service.instanceId) {
      console.log('The selected service disappeared!');
      selectService(undefined);
    }

    // Remove the associated device from the map only if it has no other Heart
    // Rate services exposed.
    if (!heartRateDevicesMap.hasOwnProperty(service.deviceAddress))
      return;

    chrome.bluetooth.getDevice(service.deviceAddress, function (device) {
      if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError.message);
        return;
      }

      chrome.bluetoothLowEnergy.getServices(device.address,
                                            function (services) {
        if (chrome.runtime.lastError) {
          // Error obtaining services. Remove the device from the map.
          console.log(chrome.runtime.lastError.message);
          delete heartRateDevicesMap[device.address];
          updateDeviceSelector();
          return;
        }

        var found = false;
        for (var i = 0; i < services.length; i++) {
          if (services[i].uuid == HEART_RATE_SERVICE_UUID) {
            found = true;
            break;
          }
        }

        if (found)
          return;

        console.log('Removing device: ' + device.address);
        delete heartRateDevicesMap[device.address];
        updateDeviceSelector();
      });
    });
  });

  // Track GATT services as they change.
  chrome.bluetoothLowEnergy.onServiceChanged.addListener(function (service) {
    // This only matters if the selected service changed.
    if (!heartRateService || service.instanceId != heartRateService.instanceId)
      return;

    console.log('The selected service has changed');

    // Reselect the service to force an updated.
    selectService(service);
  });

  // Track GATT characteristic value changes. This event will be triggered after
  // successful characteristic value reads and received notifications and
  // indications.
  chrome.bluetoothLowEnergy.onCharacteristicValueChanged.addListener(
      function (chrc) {
    if (heartRateMeasurementCharacteristic &&
        chrc.instanceId == heartRateMeasurementCharacteristic.instanceId) {
      console.log('Heart Rate Measurement value changed');
      heartRateMeasurementCharacteristic = chrc;
      updateHeartRateMeasurementValue();
      return;
    }
  });
}

document.addEventListener('DOMContentLoaded', main);
