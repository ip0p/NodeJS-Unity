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
        user.data = { playerID: 0, name: "", matchID: "", pos: "" }

        user.data.playerID = playerID;
        user.emit("SET_PLAYERID", { playerID: playerID })


    });

    user.on("CREATE_MATCH", function (data) {

        // create new matchID
        matchID++;

        // set user name
        user.data.name = data.name;

        // prepare data
        var match = {matchID:"", startPos: [] };

        // debug
        user.data.matchID = data.matchID;

        //// create match string
        //user.data.matchID = "Match"+ matchID.toString();
        console.log(user.data.name + " created a new match " + user.data.matchID);

        match.matchID = user.data.matchID;

        // add startpositions to match
        match.startPos.push(data.spawn0);
        match.startPos.push(data.spawn1);
        match.startPos.push(data.spawn2);
        match.startPos.push(data.spawn3);

        console.log(match.name);

        // add match to array
        matches.push(match);
        user.match = match;

        // join room
        user.join(user.data.matchID);
        io.to(user.data.matchID).emit("MATCH_CREATED");

        console.log(match.matchID);
        console.log(match.startPos.length);
        for (var i = 0; i < match.startPos.length; i++) {
            console.log(match.startPos[i]);
        }
    });

    user.on("JOIN_MATCH", function (data) {

        // debug
        //data.matchID = "test";

        console.log(user.data.playerID + "joined " + data.matchID);
        user.data.matchID = data.matchID;

        // join room
        user.join(user.data.matchID);

    });

    user.on("READY", function (data) {

        console.log(data.name+ " joined the game! PARTY HARD!" + "(" + user.data.matchID + ")");
        user.data.name = data.name;

        clients.push(user);

        //save already connected players
        var otherPlayers = [];
        for (var i = 0; i < clients.length; i++) {
            if (clients[i].data.matchID == user.data.matchID && clients[i].data.playerID != user.data.playerID) {
                otherPlayers.push(clients[i].data)
            }
        };

        // send other players only to me
        if(otherPlayers.length != 0)
        {
            console.log("Send other players to " + user.data.name)
            user.emit("OTHER_PLAYERS",  { otherPlayers } );
        }

        // send to everyone that i am connected
        user.to(user.data.matchID).broadcast.emit("USER_CONNECTED", user.data);

    });

    user.on("MATCH_START", function (data) {
        
        console.log("Start Match "+ data.matchID);

        var playerNumber = 0;
        var matchIndex = -1;

        // first find the current match in matches list
        for (var i = 0; i < matches.length; i++) {
            if(matches[i].matchID == data.matchID)
            {
                matchIndex = i;
                break;
            }
        }

        // set start positions for each player in match and send match start
        for (var i = 0; i < clients.length; i++) {
            if (clients[i].data.matchID == user.data.matchID) {
                clients[i].data.pos = matches[matchIndex].startPos[playerNumber];
                io.to(data.matchID).emit("MATCH_START", clients[i].data);
                playerNumber++;
            }
        };

    });


    user.on("PLAYER_MOVETO", function(data) {

        user.data.pos = data.pos;

        // send to all others
        user.broadcast.emit("PLAYER_MOVETO", user.data);

        console.log(user.data.name + " move to " + data.pos);
    });

    // if get spawn bomb from client send back to this client AND all others
    user.on("PLAYER_SPAWNBOMB", function () {

        console.log(user.data.name+ " planted a bomb.");
        io.to(user.data.matchID).emit("PLAYER_SPAWNBOMB", user.data);

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
    });

});

server.listen(app.get('port'), function ()
{
    console.log("------------------- SERVER IS RUNNING! YES BABY! :D");
    console.log("---------------------------------------------------");
});