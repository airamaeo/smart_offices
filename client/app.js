const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const readlineSync = require('readline-sync');

//For Meeting Room Control Service
const PROTO_PATH_MEET = __dirname + '/protos/meeting.proto';
const meetDefinition = protoLoader.loadSync(PROTO_PATH_MEET);
const meet_proto = grpc.loadPackageDefinition(meetDefinition).meeting;
const bookRoomClient = new meet_proto.MeetingRoomControl("0.0.0.0:40000",grpc.credentials.createInsecure());

//For Lights Control Service
var PROTO_PATH_LIGHT = __dirname + '/protos/light.proto';
var lightDefinition = protoLoader.loadSync(PROTO_PATH_LIGHT);
var light_proto = grpc.loadPackageDefinition(lightDefinition).lights;
var roomlightsClient = new light_proto.LightControl("0.0.0.0:40000",grpc.credentials.createInsecure());

//For Temperature Control Service
const PROTO_PATH_TEMP = __dirname + '/protos/temperature.proto';
const tempDefinition = protoLoader.loadSync(PROTO_PATH_TEMP);
const temperature_proto = grpc.loadPackageDefinition(tempDefinition).temperature;
const tempClient = new temperature_proto.TemperatureControl("0.0.0.0:40000",grpc.credentials.createInsecure());

//FUNCTIONS

//MEETING ROOM CONTROL SERVICE

//Function for checking room availability & booking the room if available (Unary RPC)
function checkAndBookRoomAvailability() {
  console.log("Executing checkAndBookRoomAvailability");
  const request = {
    room_id: 'roomA',
    date: '2024-01-01',
    start_time: '09:00',
    end_time: '10:00',
  };

  console.log('Checking room availability...');

  bookRoomClient.CheckAvailability(request, (error, response) => {
    if (!error) {
      console.log('Availability:', response.available);
      console.log('Message:', response.message);
    //If the room is available, give option to book the room
      if (response.available) {
        const bookRoomAction = readlineSync.keyInYNStrict("Do you want to book the room?");
        if(bookRoomAction) {
          console.log("Room booked successfully!"); //Booking confirmation
        }
      }
    } else {
      console.error(error);
      }
    });
}

//Function for communicating/ sending messages between all rooms (Bi-directional Streaming RPC)
function performBidirectionalStreamingWithMeetingRooms() {
  const rooms = ['roomA', 'roomB', 'roomC', 'roomD'];

  rooms.forEach((room_id) => {
    const message = readlineSync.question(`Enter a message for ${room_id}: `);

    const stream = bookRoomClient.BidirectionalStream();

    stream.on('data', (response) => {
      console.log(`Received response from server in room ${response.room_id}: ${response.message}`);
    });

    stream.on('end', () => {
      console.log('Bi-directional streaming for room ' + room_id + ' ended.');
    });

    stream.on('error', (error) => {
      console.error(`Error in bi-directional streaming for room ${room_id}:`, error);
    });

    stream.on('status', (status) => {
      console.log(`Bi-directional streaming status for room ${room_id}:`, status);
    });

    stream.write({ room_id, message });

    stream.end();
  });
}

//LIGHTS CONTROL SERVICE

//Function to toggle lights
function toggleLights() {
  roomlightsClient.TurnOnOff({ on: true }, (error, response) => {
    if (!error && response.success) {
      console.log("Lights toggled successfully");
    } else {
      console.error("Error in toggling lights:", error);
    }
  });
}

//Function to adjust brightness
function adjustBrightness(brightness) {
  roomlightsClient.AdjustBrightness({ brightness }, (error, response) => {
    if (!error && response.success) {
      console.log("Brightness adjusted successfully");
    } else {
      console.error("Error in adjusting brightness:", error);
    }
  });
}

//TEMPERATURE CONTROL SERVICE

//Function to start the client
function startClient() {
  let roomATemp = "23";
  let roomBTemp = "23";
  let roomCTemp = "23";
  let roomDTemp = "23";

  // Function to stream temperatures (Server-side Streaming RPC)
  function streamTemperatures() {
    const room_id = readlineSync.question("Please enter the room ID to stream temperatures: ");

    const stream = tempClient.StreamTemperatures({ room_id: room_id });

    let updateCount = 0;
    const maxUpdates = 20;

    stream.on('data', (response) => {
      console.log(`Current Temperature in Room ${room_id}: ${response.currentTemperature}°C`);

      updateCount++;
      if (updateCount >= maxUpdates) {
        stream.cancel(); // or stream.end()
      }
    });

    stream.on('end', () => {
      console.log('Temperature stream ended.');
    });

    stream.on('error', (error) => {
      if (error.code === grpc.status.CANCELLED) {
        console.log('Temperature stream was cancelled by the client.');
      } else {
        console.error('Error in temperature stream:', error);
      }
    });

    stream.on('status', (status) => {
      console.log('Temperature stream status:', status);
    });
  }

  //Function to stream temperature readings (Client-side Streaming RPC)
  function streamTemperatureReadings(room_id) {
    const stream = tempClient.StreamTemperatureReadings((error, response) => {
      if (error) {
        console.error('Error in temperature readings stream:', error);
      } else {
        console.log(`Average Temperature in ${room_id}: ${response.currentTemperature}°C`);
      }
    });

    // Simulate streaming random temperature readings
    const numReadings = 5;  // Number of readings to generate
    const minTemperature = 20;  // Minimum temperature
    const maxTemperature = 30;  // Maximum temperature

    for (let i = 0; i < numReadings; i++) {
      const temperature = Math.random() * (maxTemperature - minTemperature) + minTemperature;
      const request = { temperature, room_id };  // Ensure room_id is set in the request
      stream.write(request);
    }

    stream.end(); // End the stream after sending all readings
  }


  //MAIN LOOP
  while(true) {
    const action = readlineSync.question(
      "What would you like to do?\n" +
      "\t 1 For Meeting Room Features (Availability, Booking & Chats)\n" +
      "\t 2 To adjust the meeting room light settings\n" +
      "\t 3 To adjust the meeting room temperature settings\n" +
      "\t 4 For Temperature Streaming Features\n" +
      "\t q To quit\n");

    if(action.toLowerCase() === 'q') {
      console.log("Goodbye!");
      break;
    } else if (action === '1') {
        const roomAction = readlineSync.question(
          "Select function for the meeting room\n" +
          "\t 1 To check & book room availability\n" +
          "\t 2 To connect & chat with other meeting rooms\n" +
          "\t q To go back\n");

          if (roomAction === '1') {
            checkAndBookRoomAvailability();
          } else if (roomAction === '2') {
            performBidirectionalStreamingWithMeetingRooms();
          } else {
            console.log("Input not recognized. Please try again.");
          }
    } else if (action === '2') {
        const lightAction = readlineSync.question(
          "What would you like to do with the lights?\n" +
          "\t 1 To toggle lights\n" +
          "\t 2 To adjust brightness\n" +
          "\t q To go back\n");

          if (lightAction === '1') {
            toggleLights();
          } else if (lightAction === '2') {
            const brightness = readlineSync.question("Please enter the brightness level: ");
            adjustBrightness(parseFloat(brightness));
          } else if (lightAction.toLowerCase() === 'q') {
            //To go back
          } else {
            console.log("Input not recognized. Please try again.");
          }
    } else if (action === '3') {
        while (true) {
            const roomId = readlineSync.question(
              "Please enter meeting room ID to set new temperature.\n" +
              "\t 1 roomA\n" +
              "\t 2 roomB\n" +
              "\t 3 roomC\n" +
              "\t 4 roomD\n" +
              "\t 5 to view current temperature\n");

          if (roomId === '5') {
            console.log("Current temperatures in each room:");
            console.log("\t roomA: " + (roomATemp === "" ? "Temperature set to default." : roomATemp));
            console.log("\t roomB: " + (roomBTemp === "" ? "Temperature set to default." : roomBTemp));
            console.log("\t roomC: " + (roomCTemp === "" ? "Temperature set to default." : roomCTemp));
            console.log("\t roomD: " + (roomDTemp === "" ? "Temperature set to default." : roomDTemp));

            const setAnotherTemp = readlineSync.keyInYNStrict("Do you want to set a new temperature?");
            if (!setAnotherTemp) {
              break;
            }
          } else {
            const temperature = readlineSync.question("Please enter the temperature for the room: ");

            switch (roomId) {
              case '1': roomATemp = temperature; break;
              case '2': roomBTemp = temperature; break;
              case '3': roomCTemp = temperature; break;
              case '4': roomDTemp = temperature; break;
            }
            const setAnotherTemp = readlineSync.keyInYNStrict("Do you want to set the temperature for another room?");
            if (!setAnotherTemp) {
              break;
            }
          }
        }
    } else if (action === '4') {
        const tempAction = readlineSync.question(
          "Select function for the temperature streaming\n" +
          "\t 1 To stream current temperatures\n" +
          "\t 2 To stream temperature readings\n" +
          "\t q To go back\n");

          if (tempAction === '1') {
            streamTemperatures();
          } else if (tempAction === '2') {
              const room_id = readlineSync.keyInSelect(['roomA', 'roomB', 'roomC', 'roomD'], 'Select the room ID to stream temperatures:');
              if (room_id !== -1) {
                streamTemperatureReadings(['roomA', 'roomB', 'roomC', 'roomD'][room_id]);
              } else if (tempAction.toLowerCase() === 'q') {
            //To go back
              } else {
                console.log("Input not recognized. Please try again.");
              }
          } else {
        console.log("Input not recognized. Please try again.");
      }
    }
  }
}

//Starting the client
tempClient.waitForReady(Date.now() + 5000, (error) => {
  if (!error) {
    console.log('You are now connected to the server!');
    startClient();
  } else {
    console.error('Oh no! Error in connecting to the server:', error);
    console.error('Please make sure the server is started.');
    process.exit(1);
  }
});
