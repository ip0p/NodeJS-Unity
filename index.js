var express = require('express');
var app = express();

var server = require('http').createServer(app)
var io = require('socket.io').listen(server);

app.set('port', process.env.PORT || 3000)

var clients = [];
var matches = [];
var playerID = 0;
var matchID = 0;


io.on("connection", function(user) {

    //only me
    user.emit("NEW_USER");

    // only others
    user.broadcast.emit("NEW_USER");

    // all
    io.emit("NEW_USER");

    user.on("USER_CONNECT", function () {

        playerID++;
        console.log('New User with ID ' + playerID + ' connected!');

        // prepare data
        user.data = { playerID: 0, name: "", matchID: "", posX: 0, posZ: 0 }

        user.data.playerID = playerID;
        user.emit("SET_PLAYERID", { playerID: playerID })


    });

    user.on("CREATE_MATCH", function (data) {

        // create new matchID
        matchID++;

        // set user name
        user.data.name = data.name;

        // prepare data
        var match = [];

        // debug
        user.data.matchID = "test";

        //// create match string
        //user.data.matchID = "Match"+ matchID.toString();
        console.log(user.data.name + " created a new match " + user.data.matchID);

        // add match to array
        match.matchID = user.matchID;
        match.push(data.spawn0);
        match.push(data.spawn1);
        match.push(data.spawn2);
        match.push(data.spawn3);

        matches.push(match);
        user.match = match;

        // join room
        user.join(user.data.matchID);
        io.to(user.data.matchID).emit("MATCH_CREATED");

        console.log(match.matchID);
        for (var i = 0; i < match.length; i++) {
            console.log(match[i]);
        }
    });

    user.on("JOIN_MATCH", function (data) {

        // debug
        data.matchID = "test";

        console.log(user.data.playerID + "joined " + data.matchID);
        user.data.matchID = data.matchID;

        // join room
        user.join(user.data.matchID);
    });

    user.on("READY", function (data) {

        console.log(data.name+ " joined the game! PARTY HARD!" + "(" + user.data.matchID + ")");
        user.data.name = data.name;

        clients.push(user);
        console.log(user.data.matchID);

        // send already connected players
        //for (var i = 0; i < clients.length; i++) {
        //    if (clients[i].data.matchID === user.data.matchID) {
        //        user.to(user.data.matchID).emit("USER_CONNECTED", clients[i].data);
        //    }
        //};

        user.to(user.data.matchID).emit("USER_CONNECTED", user.data);


        //// send welcome message
        //var users = [];
        //for (var i = 0; i < clients.length; i++)
        //    users.push(clients[i].data);
        //user.emit('OTHER_PLAYERS', users);

    });

    user.on("MOVE", function(data) {
        user.data.posX = data.posX;
        user.data.posZ = data.posZ;
        user.data.rotation = data.rotation;
        //user.emit("MOVE", currentUser);
        user.broadcast.emit("MOVE", user.data);
        //console.log(currentUser.name + " move to " + data.rotation);
    });

    // if get spawn bullet from client send back to this client AND all others
    user.on("SPAWN_BULLET", function (data) {
        io.emit("SPAWN_BULLET", data);

    });

    user.on("disconnect", function() {

        //console.log("User disconnected "+ user.matchID);

        //user.broadcast.emit("USER_DISCONNECTED", user.data);

        for (var i = 0; i < clients.length; i++) {
            if (clients[i] === user) {
                console.log("User " + clients[i].name + " disconnected");
                clients.splice(i, 1);
            }
        };
    })
});

server.listen(app.get('port'), function ()
{
    console.log("------------------- SERVER IS RUNNING! YES BABY! :D");
    console.log("---------------------------------------------------");
});