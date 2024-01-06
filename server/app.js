const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const express = require('express');
const path = require('path');
const app = express();


//For Meeting Room Control Service
const PROTO_PATH_MEET = __dirname + '/protos/meeting.proto';
const meetDefinition = protoLoader.loadSync(PROTO_PATH_MEET);
const meet_proto = grpc.loadPackageDefinition(meetDefinition).meeting;

//For Light Control Service
const PROTO_PATH_LIGHT = __dirname + '/protos/light.proto';
const lightDefinition = protoLoader.loadSync(PROTO_PATH_LIGHT);
const light_proto = grpc.loadPackageDefinition(lightDefinition).lights;

//For Temperature Control Service
const PROTO_PATH_TEMP = __dirname + '/protos/temperature.proto';
const tempDefinition = protoLoader.loadSync(PROTO_PATH_TEMP);
const temperature_proto = grpc.loadPackageDefinition(tempDefinition).temperature;

const server = new grpc.Server();

//MEETING ROOM CONTROL SERVICE

let bookedRooms = {};

const meetingRoomControlService = {
  CheckAvailability: (call, callback) => {
    const { room_id, date, start_time, end_time } = call.request;

    if (!bookedRooms[room_id]) {
          bookedRooms[room_id] = true;
          const response = { available: true, message: 'The room is available.' };
          callback(null, response);
        } else {
          const response = { available: false, message: 'The room is not available.' };
          callback(null, response);
    }
  },

  BidirectionalStream: (call) => {
    call.on('data', (request) => {
      console.log(`Received message request from client in room ${request.room_id}: ${request.message}`);

      const response = { room_id: request.room_id, message: 'The server received your message' };
      call.write(response);
    });

    call.on('end', () => {
      call.end();
    });

    call.on('error', (error) => {
      console.error('Error found in bi-directional streaming:', error);
    });

    call.on('cancelled', () => {
      console.log('Bi-directional streaming cancelled.');
    });
  },
};

//LIGHTS CONTROL SERVICE

const lightControlService ={
  TurnOnOff: (call, callback) => {
    const { on } = call.request;
    console.log(`The lights are turned ${on ? 'on' : 'off'}`);
    callback(null, { success: true });
  },

  AdjustBrightness: (call, callback) => {
    const { brightness } = call.request;
    console.log(`The room brightness is adjusted to ${brightness}`);
    callback(null, { success: true });
  },
};

//TEMPERATURE CONTROL SERVICE

const temperatureControlService = {
  SetTemperature: (call, callback) => {
    const { temperature } = call.request;
    console.log(`Temperature set to ${temperature}°C`);
    callback(null, { success: true });
  },

  StreamTemperatures: (call) => {
    const { room_id } = call.request;

    const intervalId = setInterval(() => {
      const currentTemperature = Math.random() * (30 - 20) + 20; //Simulate temperature changes
      const response = { currentTemperature, success: true };
      call.write(response);
    }, 1000);

    call.on('cancelled', () => {
      clearInterval(intervalId);
      call.end();
    });
  },

  StreamTemperatureReadings: (call, callback) => {
    let totalTemperature = 0;
    let count = 0;
    let room_id = ['roomA', 'roomB', 'roomC', 'roomD'];

    call.on('data', (request) => {
      const room_id = request.room_id || 'unknown :( ';
      console.log(`Received temperature reading from client in ${room_id}: ${request.temperature}°C`);
      totalTemperature += request.temperature;
      count++;
    });

    call.on('end', () => {
      //Calculate average temperature
      const averageTemperature = count === 0 ? 0 : totalTemperature / count;

      //Response to the client
      const response = { currentTemperature: averageTemperature, success: true };
      callback(null, response);
    });

    call.on('error', (error) => {
      console.error('Error in client streaming:', error);
      callback(error, null);
    });

    call.on('cancelled', () => {
      console.log('Client streaming cancelled.');
    });
  },
};

server.addService(meet_proto.MeetingRoomControl.service, meetingRoomControlService);
server.addService(light_proto.LightControl.service, lightControlService);
server.addService(temperature_proto.TemperatureControl.service, temperatureControlService);

server.bindAsync("0.0.0.0:40000", grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Error binding gRPC server:', err);
  } else {
    console.log(`Server is running on port ${port}`);
    server.start();
  }
});

//GUI implementation
app.use(express.static(path.join(__dirname, 'public')));

// Route for the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// Start Express server
const port = 3000;
app.listen(port, () => {
  console.log(`Express server is running on http://localhost:${port}`);
});
