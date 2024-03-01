const noble = require('@abandonware/noble');

const DEBUG = false;
var args = process.argv.slice(2);
if (args.length < 1) {
    console.error('Usage: node report.js <IAM-T1 MAC Address> <Location>');
    process.exit(1);
}

const DEVICE_MAC = args[0];
const DEVICE_LOC = args[1] || 'unspecified';

console.log(`Looking for device with address ${DEVICE_MAC}...`);

const printIt = () => {
    console.log(new Date());
};
DEBUG && printIt();
DEBUG && setTimeout(printIt, 60000);

// Data parsing from: https://github.com/esphome/esphome-devices/pull/601/files
const getCO2 = (data) => {
    return (data[9] << 8) | data[10];
}

const getTemp = (data) => {
    const isNegative = data[4] & 0xF;
    const temp = (data[5] << 8) | data[6];
    if (isNegative === 1) {
      return -(temp) / 10.0;
    } else {
      return (temp) / 10.0;
    }
};

const getHumidity = (data) => {
    return ((data[7] << 8) | data[8]) / 10.0;
};

const getPressure = (data) => {
   return (data[11] << 8) | data[12];
};

const reportReadings = async (data) => {
    console.log('CO2: ', getCO2(data));
    console.log('TEMP: ', getTemp(data));
    console.log('HUMIDITY: ', getHumidity(data));
    console.log('PRESS', getPressure(data));
};

noble.on('stateChange', async (state) => {
    if (state === 'poweredOn') {
        await noble.startScanningAsync([], false);
    } else {
        await noble.stopScanning();

    }
});

noble.on('discover', async (peripheral) => {
    DEBUG && console.debug('discovered: ', peripheral.address);
    if (peripheral.address.toLowerCase() === DEVICE_MAC.toLowerCase()) {

        console.log(`Found device with address ${DEVICE_MAC}`);

        peripheral.on('disconnect', () => {
            process.exit(0);
        });
    
        try {
            await noble.stopScanning();
            await peripheral.connectAsync();

            const services = await peripheral.discoverServicesAsync([]);

            for (const service of services) {

                const characteristics = await service.discoverCharacteristicsAsync([]);

                for (const characteristic of characteristics) {
                    if (characteristic.uuid === 'ffe4') {
                        console.log('Listening for data from characteristice ffe4');
                        await characteristic.notifyAsync(true);
                        characteristic.on('data', (data) => {
                            reportReadings(data);
                        });
                    }
                }
            }

        } catch (err) {
            console.log(`Error connecting to device at ${DEVICE_MAC}`);
            console.log(err);
        }
    }
});

process.on('SIGINT', function () {
    noble.stopScanning(() => process.exit());
});

process.on('SIGQUIT', function () {
    noble.stopScanning(() => process.exit());
});

process.on('SIGTERM', function () {
    noble.stopScanning(() => process.exit());
});

