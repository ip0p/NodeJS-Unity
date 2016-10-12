var express = require('express');
var app = express();

var server = require('http').createServer(app)
var io = require('socket.io').listen(server);

app.set('port', process.env.PORT || 3000)

var clients = [];
var ID = 0;


io.on("connection", function (user) {

    //only me
    user.emit("NEW_USER");

    // only others
    user.broadcast.emit("NEW_USER");
    
    // all
    io.emit("NEW_USER");

    //var currentUser;

    user.on("USER_CONNECT", function () {
        ID++;
        console.log('New User with ID '+ ID +' connected!');

        user.emit("SET_PLAYERID", { playerID: ID })

        //for (var i = 0; i < clients.length; i++) {
        //    user.emit("USER_CONNECTED", { name: clients[i].data });

        //    console.log(clients[i].name + " is connected!");
        //};
    });

    user.on("PLAY", function (data) {

        console.log(data.name+ " joined the game! PARTY HARD!");
        user.data = {playerID: ID, name:data.name}

        clients.push(user);
        user.emit("PLAY", user.data);
        user.broadcast.emit("USER_CONNECTED", user.data);


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

        console.log("User disconnected");

        user.broadcast.emit("USER_DISCONNECTED", user.data);

        for (var i = 0; i < clients.length; i++) {
            if (clients[i].playerID === user.data.playerID) {
                console.log("User " + clients[i].name + " disconnected");
                clients.splice(i, 1);
            }
        };
    })


});

server.listen(app.get('port'), function ()
{
    console.log("------------------- SERVER IS RUNNING! YES BABY! :D");
});