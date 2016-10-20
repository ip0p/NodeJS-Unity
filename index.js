var colors = require('colors');
var express = require('express');
var app = express();

var server = require('http').createServer(app)
var io = require('socket.io').listen(server);

const PORT = process.env.PORT || 3000;

app.set('port', PORT)

var clients = []; // stores all clients
var matches = []; // stores all created matches
var playerID = 0; 

io.on("connection", function(user) {


    console.log("user connected");
    
    //only me
    //user.emit("NEW_USER");

    // only others
    //user.broadcast.emit("NEW_USER");

    // all
    //io.emit("NEW_USER");

    user.on("USER_CONNECT", function () {

        playerID++;
        console.log('New User with ID ' + playerID + ' connected!');

        // prepare data
        user.data = { playerID: 0, name: "", matchID: "", pos: "", score: 0, bombs: 1, range: 1 }

        user.data.playerID = playerID;
        user.emit("SET_PLAYERID", { playerID: playerID })

        io.emit("UPDATE_MATCHLIST", {data: matches});


    });

    user.on("CREATE_MATCH", function (data) {

        // set user name
        user.data.name = data.name;

        // create match object
        var match = { matchID:"", maxPlayers: 4, currentPlayers: 0, startPos: [], powerups: [[]] };

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

        match.powerups = generatePowerUps();

        // add match to array
        matches.push(match);

        // save match to user
        user.match = match;

        // join room and increase player counter
        user.join(user.data.matchID);
        match.currentPlayers++;

        io.to(user.data.matchID).emit("MATCH_CREATED");

        io.emit("UPDATE_MATCHLIST", {data: matches});

    });

    user.on("JOIN_MATCH", function (data) {

        // debug
        //data.matchID = "test";

        console.log(user.data.playerID + "joined " + data.matchID);
        user.data.matchID = data.matchID;

        // join room and increase player counter
        user.join(user.data.matchID);
        getMatchByID(user.data.matchID).currentPlayers++;
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
            user.emit("OTHER_PLAYERS",  { data: otherPlayers } );
        }

        // send to everyone that i am connected
        user.to(user.data.matchID).broadcast.emit("USER_CONNECTED", user.data);

    });

    user.on("MATCH_START", function (data) {
        
        // gets match start from match creator user and sends back match start to all
        
        console.log("Start Match "+ data.matchID);

        var playerNumber = 0;
        var match = getMatchByID(user.data.matchID);

        var players = [];

        // set start positions for each player in match and send match start
        for (var i = 0; i < clients.length; i++) {
            if (clients[i].data.matchID == user.data.matchID) {
                clients[i].data.pos = match.startPos[playerNumber];
                players.push(clients[i].data);
                playerNumber++;
            }
        };

        io.to(data.matchID).emit("MATCH_START", {data: players});
    });


    user.on("MATCH_DORESTART", function (data) {
        
        console.log("Restart Match "+ user.data.matchID);

        var playerNumber = 0;
        var match = getMatchByID(user.data.matchID);

        // set start positions for each player in match and send match start
        for (var i = 0; i < clients.length; i++) {
            if (clients[i].data.matchID == user.data.matchID) {
                clients[i].data.pos = match.startPos[playerNumber];
                clients[i].data.range = 1;
                clients[i].data.bombs = 1;
                io.to(user.data.matchID).emit("MATCH_RESTART", clients[i].data);
                playerNumber++;
            }
        };

    });

    user.on("PLAYER_MOVETO", function(data) {

        user.data.pos = data.pos;

        // send to all others in the room
        user.to(user.data.matchID).broadcast.emit("PLAYER_MOVETO", user.data);
        console.log(user.data.name + " move to " + data.pos);

        var match = getMatchByID(user.data.matchID);

        for (var i = 0; i < match.powerups.length; i++) {
            
            // check if there is a powerup at the pos and pick up
            if(match.powerups[i].pos == user.data.pos && match.powerups[i].type > 0 && match.powerups[i].show == true)
            {
                if(match.powerups[i].type == 1) // range
                    user.data.range++;

                if(match.powerups[i].type == 2) // bombs
                    user.data.bombs++;

                // set show to false after pickup 
                match.powerups[i].show = false;

                // send updated player information to room
                io.to(user.data.matchID).emit("PLAYER_UPDATE", user.data);
            }
        }
    });

    // if get spawn bomb and bomb pos from client send back to this client AND all others
    user.on("PLAYER_SPAWNBOMB", function (data) {

        console.log(user.data.name+ " planted a bomb. At " + user.data.pos);
        io.to(user.data.matchID).emit("PLAYER_SPAWNBOMB", user.data);

    });

    user.on("EXPLOSION", function (data) {

    	if(data == null)
        	return;

        var match = getMatchByID(user.data.matchID);

    	for (var i = 0; i < data.pos.length; i++) {
    		
    		if(data.destroy[i] == true)
    		{
    			for (var p = 0; p < match.powerups.length; p++) 
    			{
	                // check if there is a powerup at the pos
	                if(match.powerups[p].pos == data.pos[i] && match.powerups[p].type > 0)
	                {
	                    // set show to true to allow players to pickup the powerup
	                    match.powerups[p].show = true;

	                    console.log("spawn powerup type " + match.powerups[p].type);
	                    user.emit("POWERUP", match.powerups[p]);
	                }
            	}
        	}
            else
    		{
	    		// if the player is at this position kill player
	            if(user.data.pos == data.pos[i])
	            {
	                console.log("player died -> " + user.data.name+" at "+user.data.pos);
	                io.to(user.data.matchID).emit("PLAYER_DIE", user.data);
	                match.currentPlayers--;

	                console.log(match.currentPlayers);

	                // if last player give score and send match restart
	                if(match.currentPlayers <= 1)
	                {
	                	user.data.score++;
	                	console.log(user.data.name+" wins the match. score is now "+ user.data.score);

				        console.log("Restart Match "+ user.data.matchID);

				        var playerNumber = 0;

				        // set start positions for each player in match and send match start
				        for (var i = 0; i < clients.length; i++) {
				            if (clients[i].data.matchID == user.data.matchID) {
				                clients[i].data.pos = match.startPos[playerNumber];
				                clients[i].data.range = 1;
				                clients[i].data.bombs = 1;
				                io.to(user.data.matchID).emit("MATCH_RESTART", clients[i].data);
				                playerNumber++;
				            }
				        };

				        // reset currentplayers
				        match.currentPlayers = playerNumber;

				        // regenerate powerups
				        match.powerups = generatePowerUps();
	                }
	                // break here to make sure player isnt killed twice
	                break;
	            }
    		}
    	}
    });

    // simple ping funtion gets ping sends ping back
    user.on("PING", function() {

    	//console.log(Date.now().toString());
        user.emit("PING", {time: ""+Date.now().toString()});
    });

    user.on("disconnect", function() {

        // remove player from client list and send kill to all players
        for (var i = 0; i < clients.length; i++) {
            if (clients[i] === user) {
                console.log("User " + clients[i].data.name + " disconnected");
                clients.splice(i, 1);

                // send kill player to the match
                io.to(user.data.matchID).emit("PLAYER_DIE", user.data);

                // remove player created match from match list
                // TODO find another way since this causing a crash because other functions use the matches
                var matchIndex = matches.indexOf(user.match);
                matches.splice(matchIndex, 1);

                //if(matches.currentPlayers <= 1)
                //    matches.splice(user.match, 1);
                io.emit("UPDATE_MATCHLIST", {data: matches});

                console.log(matches.length);
            }
        };
    });

});

server.listen(PORT, function ()
{
    console.log(`Listening on ${PORT}`);
    //process.stdout.write('\033c'); // clear console
    console.log("-----------------------------------------------------------------------" .rainbow);
    console.log("------------------- SERVER IS RUNNING! YES BABY! :D -------------------" .green);
    console.log("-----------------------------------------------------------------------" .red);
});

/**
 * Returns a random number between min (inclusive) and max (exclusive)
 */
function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getMatchByID(matchID)
{
    var match = [];

    // first find the current match in matches list
    for (var i = 0; i < matches.length; i++) {
        if(matches[i].matchID == matchID)
        {
            match = matches[i];
            break;
        }
    }

    return match;
}

function generatePowerUps()
{


	var powerups = [];

	    // generate power ups // TODO make map size variable
        for (var x = 0; x < 50; x++) 
        {
            for (var z = 0; z < 50; z++) {
                

                if(getRandomInt(0,100) <= 20)
                {
					var powerup = { pos: x+"x"+z, type: 0, show: false };

                    if(getRandomInt(0,100) <= 50)
                    {
                        powerup.type = 1;
                    }
                    else
                    {
                        powerup.type = 2;
                    }

                    powerups.push(powerup);
                }
            }
        }

        console.log("Generated powerups array length "+ powerups.length);
        return powerups;
}