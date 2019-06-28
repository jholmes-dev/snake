// Some packages we're going to need
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

// Routing
app.use(express.static(__dirname + '/html/assets'));

// Home page, server login page
app.get('/', function(req, res) {
	res.sendFile(__dirname + '/html/index.html');

});

var surTimer;

var gameSpeed = 100;
var started = false;
var renderLoop;
var pNum = 0;
var starLoc = [null]; 
var powerUpLoc = [null];
var powerUpTimer;
var wallLoc = [null];
var wallTimer;
var boardW = 150;
var boardH = 150;
var board = [],
	boardIni = false;

var p1 = {
	socket: null,
	color: "black",
	snake: [[3, 1], [2, 1], [1, 1]],
	direction: "right",
	olddir: null,
	grow: 0,
	walling: false,
	dead: false,
	score: 0
};

var p2 = {
	socket: null,
	color: "green",
	snake: [[boardW-2, 3], [boardW-2, 2], [boardW-2, 1]],
	direction: "down",
	olddir: null,
	grow: 0,
	walling: false,
	dead: false,
	score: 0
};

var p3 = {
	socket: null,
	color: "gray",
	snake: [[boardW-4, boardH-2], [boardW-3, boardH-2], [boardW-2, boardW-2]],
	direction: "left",
	olddir: null,
	grow: 0,
	walling: false,
	dead: false,
	score: 0
};



// Socket handling
var lobby = io.on('connection', function(socket) {
	pNum++;
	lobby.emit("num players", pNum);
	if (p1.socket == null) {
		console.log("Player 1 assigned.");
		p1.socket = socket.id;
		socket.emit("player", 1);
	} else if (p2.socket == null) {
		console.log("Player 2 assigned.");
		p2.socket = socket.id;
		socket.emit("player", 2);
	} else if (p3.socket == null) {
		console.log("Player 3 assigned.");
		p3.socket = socket.id;
		socket.emit("player", 3);
	} else {
		socket.emit("error msg", "Game is full.");
	}
	
	// Handle directional input
	socket.on("change direction", function(dir) {
		if (socket.id == p1.socket) {
			if (checkDir(dir, p1.olddir))
				p1.direction = dir;
		} else if (socket.id == p2.socket) {
			if (checkDir(dir, p2.olddir))
				p2.direction = dir;
		} else if (socket.id == p3.socket) {
			if (checkDir(dir, p3.olddir))
				p3.direction = dir;
		}
	});

	// Handles end popping request
	socket.on("pop end", function() {
		if (socket.id == p1.socket) {
			if (p1.snake.length > 6) {
				for (var i = 0; i < 5; i++) {
					p1.snake.pop();
				}
			}
		} else if (socket.id == p2.socket) {
			if (p2.snake.length > 6) {
				for (var i = 0; i < 5; i++) {
					p2.snake.pop();
				}
			}
		} else if (socket.id == p3.socket) {
			if (p3.snake.length > 6) {
				for (var i = 0; i < 5; i++) {
					p3.snake.pop();
				}
			}	
		}
	}); // End pop handling

	socket.on("start", function() {
		if (!started)
			startGame();
	});

	socket.on("disconnect", function() {
		pNum--;
		lobby.emit("num players", pNum);
		if (socket.id == p1.socket) {
			p1.socket = null;
		} else if (socket.id == p2.socket) {
			p2.socket = null;
		} else if (socket.id == p3.socket) {
			p3.socket = null;
		}
	});
}); // End connection handler

function startGame() {
	iniBoard();
	started = true;
	clearInterval(renderLoop);
	renderLoop = setInterval(function() {
		render();
	}, gameSpeed);
}
function stopGame() {
	clearInterval(renderLoop);

	if (p1.score > p2.score && p1.score > p3.score) {
		lobby.emit("winner", "Player 1 Wins!");
	} else if (p2.score > p1.score && p2.score > p3.score) {
		lobby.emit("winner", "Player 2 Wins!");
	} else if (p3.score > p1.score && p3.score > p2.score) {
		lobby.emit("winner", "Player 3 Wins!");
	} else {
		lobby.emit("winner", "Stalemate. Boo.");
	}

	setTimeout(function() {
		lobby.emit("reset");
		started = false;
		resetGame();
	}, 3000);
}


function resetGame() {
	clearInterval(surTimer);
	clearInterval(powerUpTimer);
	clearInterval(wallTimer);

	starLoc = [null];
	powerUpLoc = [null];
	wallLoc = [null];

	p1.snake = [[3, 1], [2, 1], [1, 1]];
	p1.direction = "right";
	p1.grow = 0;
	p1.dead = false;
	p1.score = 0;

	p2.snake = [[boardW-2, 3], [boardW-2, 2], [boardW-2, 1]];
	p2.direction = "down";
	p2.grow = 0;
	p2.dead = false;
	p2.score = 0;

	p3.snake = [[boardW-4, boardH-2], [boardW-3, boardH-2], [boardW-2, boardW-2]];
	p3.direction = "left";
	p3.grow = 0;
	p3.dead = false;
	p3.score = 0;

	for (var i = 0; i < board.length; i++) {
		for (var j = 0; j < board.length; j++) {
			board[i][j] = null;
		}
	}
}


function checkDeath() {
	if ((p1.dead == true || p1.socket == null) && (p2.dead == true || p2.socket == null) && (p3.dead == true || p3.socket == null)) {
		stopGame();
	}
}


function render() {

	// Handle movement of first player
	if (p1.socket != null && p1.dead == false) {

		// Move all the blocks forward one.
		var tempX = p1.snake[0][0];
			tempY = p1.snake[0][1];

		// Move the head first
		// Find out which location we're going to
		if (p1.direction == "down") {
			p1.snake[0][1]++;
			p1.olddir = "down";
		} else if (p1.direction == "left") {
			p1.snake[0][0]--;
			p1.olddir = "left";
		} else if (p1.direction == "up") {
			p1.snake[0][1]--;
			p1.olddir = "up";
		} else {
			p1.snake[0][0]++;
			p1.olddir = "right";
		}

		if (p1.snake[0][0] < 0 || p1.snake[0][0] >= board.length || p1.snake[0][1] < 0 || p1.snake[0][1] >= board.length || board[p1.snake[0][0]][p1.snake[0][1]] != null) {
			p1.dead = true;
			p1.snake[0][0] = tempX;
			p1.snake[0][1] = tempY;
			destroySnake(p1.snake);
		} else {
			board[p1.snake[0][0]][p1.snake[0][1]] = p1.color;
		
			// Loop through da booty
			for (var i = 1; i < p1.snake.length; i++) {

				var locTempX = p1.snake[i][0],
					locTempY = p1.snake[i][1];

				p1.snake[i][0] = tempX;
				p1.snake[i][1] = tempY;

				board[tempX][tempY] = p1.color;

				tempX = locTempX;
				tempY = locTempY;

				if (i == (p1.snake.length - 1) && p1.grow <= 0 && p1.walling == false) {
					board[tempX][tempY] = null;
				} // Delete the last link if it's not time to grow
				else if ((i == (p1.snake.length - 1)) && (p1.grow > 0 || p1.walling == true)) {
					p1.grow--;
					p1.snake.push([tempX, tempY]);
					break;
				}
			} // Done loopin through dat booty

		}

	} // End p1 snek update loop


	// Handle movement of second player
	if (p2.socket != null && p2.dead == false) {

		// Move all the blocks forward one.
		var tempX = p2.snake[0][0];
			tempY = p2.snake[0][1];

		// Move the head first
		// Find out which location we're going to
		if (p2.direction == "down") {
			p2.snake[0][1]++;
			p2.olddir = "down";
		} else if (p2.direction == "left") {
			p2.snake[0][0]--;
			p2.olddir = "left";
		} else if (p2.direction == "up") {
			p2.snake[0][1]--;
			p2.olddir = "up";
		} else {
			p2.snake[0][0]++;
			p2.olddir = "right";
		}

		if (p2.snake[0][0] < 0 || p2.snake[0][0] >= board.length || p2.snake[0][1] < 0 || p2.snake[0][1] >= board.length || board[p2.snake[0][0]][p2.snake[0][1]] != null) {
			p2.dead = true;
			p2.snake[0][0] = tempX;
			p2.snake[0][1] = tempY;
			destroySnake(p2.snake);
		} else {
			board[p2.snake[0][0]][p2.snake[0][1]] = p2.color;
		
			// Loop through da booty
			for (var i = 1; i < p2.snake.length; i++) {
				var locTempX = p2.snake[i][0],
					locTempY = p2.snake[i][1];

				p2.snake[i][0] = tempX;
				p2.snake[i][1] = tempY;

				board[tempX][tempY] = p2.color;

				tempX = locTempX;
				tempY = locTempY;

				if (i == (p2.snake.length - 1) && p2.grow <= 0 && p2.walling == false) {
					board[tempX][tempY] = null;
				} // Delete the last link if it's not time to grow
				else if ((i == (p2.snake.length - 1)) && (p2.grow > 0 || p2.walling == true)) {
					p2.grow--;
					p2.snake.push([tempX, tempY]);
					break;
				}
			} // Done loopin through dat booty
		}
	} // End p2 snek update loop


	// Handle movement of third player
	if (p3.socket != null && p3.dead == false) {

		// Move all the blocks forward one.
		var tempX = p3.snake[0][0];
			tempY = p3.snake[0][1];

		// Move the head first
		// Find out which location we're going to
		if (p3.direction == "down") {
			p3.snake[0][1]++;
			p3.olddir = "down";
		} else if (p3.direction == "left") {
			p3.snake[0][0]--;
			p3.olddir = "left";
		} else if (p3.direction == "up") {
			p3.snake[0][1]--;
			p3.olddir = "up";
		} else {
			p3.snake[0][0]++;
			p3.olddir = "right";
		}

		if (p3.snake[0][0] < 0 || p3.snake[0][0] >= board.length || p3.snake[0][1] < 0 || p3.snake[0][1] >= board.length || board[p3.snake[0][0]][p3.snake[0][1]] != null) {
			p3.dead = true;
			p3.snake[0][0] = tempX;
			p3.snake[0][1] = tempY;
			destroySnake(p3.snake);
		} else {
			board[p3.snake[0][0]][p3.snake[0][1]] = p3.color;
		
			// Loop through da booty
			for (var i = 1; i < p3.snake.length; i++) {
				var locTempX = p3.snake[i][0],
					locTempY = p3.snake[i][1];

				p3.snake[i][0] = tempX;
				p3.snake[i][1] = tempY;

				board[tempX][tempY] = p3.color;

				tempX = locTempX;
				tempY = locTempY;

				if (i == (p3.snake.length - 1) && p3.grow <= 0 && p3.walling == false) {
					board[tempX][tempY] = null;
				} // Delete the last link if it's not time to grow
				else if ((i == (p3.snake.length - 1)) && (p3.grow > 0 || p3.walling == true)) {
					p3.grow--;
					p3.snake.push([tempX, tempY]);
					break;
				}
			} // Done loopin through dat booty
		}
	} // End p3 snek update loop

	// Check for le starzors.
	var locChk = board[starLoc[0]][starLoc[1]];
	if (locChk != null) {
		if (p1.snake[0][0] == starLoc[0] && p1.snake[0][1] == starLoc[1]) {
			p1.grow = 10;
			p1.score++;
			genStar();
		}
		else if (p2.snake[0][0] == starLoc[0] && p2.snake[0][1] == starLoc[1]) {
			p2.grow = 10;
			p2.score++;
			genStar();
		}
		else if (p3.snake[0][0] == starLoc[0] && p3.snake[0][1] == starLoc[1]) {
			p3.grow = 10;
			p3.score++;
			genStar();
		}
		lobby.emit("score change", { "p1": p1.score, "p2": p2.score, "p3": p3.score });
	}
	
	// Check for le powerzorz.
	if (powerUpLoc[0] != null) {
		var powerLoc = board[powerUpLoc[0]][powerUpLoc[1]];
	}
	else {
		var powerLoc = null;
	}
	if (powerLoc != null) {
		if (p1.snake[0][0] == powerUpLoc[0] && p1.snake[0][1] == powerUpLoc[1]) {
			powerUp(1);
		}
		else if (p2.snake[0][0] == powerUpLoc[0] && p2.snake[0][1] == powerUpLoc[1]) {
			powerUp(2);
		}
		else if (p3.snake[0][0] == powerUpLoc[0] && p3.snake[0][1] == powerUpLoc[1]) {
			powerUp(3);
		}
	}

	// Check for le walling powerup
	if (wallLoc[0] != null) {
		var wallSpace = board[wallLoc[0]][wallLoc[1]];
	}
	else {
		var wallSpace = null;
	}
	if (wallSpace != null) {
		if (p1.snake[0][0] == wallLoc[0] && p1.snake[0][1] == wallLoc[1]) {
			wall(1);
		}
		else if (p2.snake[0][0] == wallLoc[0] && p2.snake[0][1] == wallLoc[1]) {
			wall(2);
		}
		else if (p3.snake[0][0] == wallLoc[0] && p3.snake[0][1] == wallLoc[1]) {
			wall(3);
		}
	}

	lobby.emit("render", [board, starLoc, powerUpLoc, wallLoc]);
	checkDeath();
} // End renderloop

// Function to destroy a motherfucker.
function destroySnake(arr) {
	for (var i = 0; i < arr.length; i++) {
		board[arr[i][0]][arr[i][1]] = null;
	}
} // End motherfucking destruction


// No backtracking, backtracking is for h4xorz
function checkDir(newD, oldD) {
	if ((newD == "down" && oldD == "up") || (newD == "up" && oldD == "down")) {
		return false;
	} else if ((newD == "left" && oldD == "right") || (newD == "right" && oldD == "left")) {
		return false;
	} else {
		return true;
	}

} // Done checking for h4xzors...


// Ini dat board.
function iniBoard() {

	if (boardIni == false) {
		// Setup board
		for (var i = 0; i < boardW; i++) {
			board.push([]);
			for (var j = 0; j < boardH; j++) {
				board[i].push(null);
			}
		}
		boardIni = true;
	}

	// Set up sneks...
	if (p1.socket != null) {
		for (var i = 0; i < p1.snake.length; i++) {
			board[p1.snake[i][0]][p1.snake[i][1]] = p1.color;
		}
	}
	if (p2.socket != null) {
		for (var i = 0; i < p2.snake.length; i++) {
			board[p2.snake[i][0]][p2.snake[i][1]] = p2.color;
		}
	}
	if (p3.socket != null) {
		for (var i = 0; i < p3.snake.length; i++) {
			board[p3.snake[i][0]][p3.snake[i][1]] = p3.color;
		}
	}

	// Give em something to fight over..
	genStar();
	genPower();
	genWall();

} // End board ini


// Get a star in a motherfucker.
function genStar() {
	do {
		starLoc[0] = Math.floor(Math.random() * board.length);
		starLoc[1] = Math.floor(Math.random() * board.length);
	} while (board[starLoc[0]][starLoc[1]] != null);
} // No more motherfucking stars motherfucker.


// Generates a powerup for cutting off tails n such
function genPower() {
	if (pNum >= 2) {
		powerUpTimer = setTimeout(function() {
			do {
				powerUpLoc[0] = Math.floor(Math.random() * board.length);
				powerUpLoc[1] = Math.floor(Math.random() * board.length);
			} while (board[powerUpLoc[0]][powerUpLoc[1]] != null);
		}, Math.floor(Math.random() * 20000 + 10000));
	}
}

// Generates a power up for walling n such
function genWall() {
	if (pNum >= 2) {
		wallTimer = setTimeout(function() {
			do {
				wallLoc[0] = Math.floor(Math.random() * board.length);
				wallLoc[1] = Math.floor(Math.random() * board.length);
			} while (board[wallLoc[0]][wallLoc[1]] != null);
		}, Math.floor(Math.random() * 14000 + 1000));
	}
} // End Wall Gen



function powerUp(player) {
	var target;
	do {
		target = Math.floor(Math.random() * pNum + 1);
	} while (target == player);
	console.log(target);
	switch (target) {
		case 1:
			if (p1.snake.length > 1) {
				board[p1.snake[p1.snake.length - 1][0]][p1.snake[p1.snake.length - 2][1]] == "red";
				p1.snake.pop();
			}
			p1.score--;
			break;
		case 2:
			if (p2.snake.length > 1) {
				board[p2.snake[p2.snake.length - 1][0]][p2.snake[p2.snake.length - 2][1]] == "red";
				p2.snake.pop();
			}
			p2.score--;
			break;
		case 3:
			if (p3.snake.length > 1) {
				board[p3.snake[p3.snake.length - 1][0]][p3.snake[p3.snake.length - 2][1]] == "red";
				p3.snake.pop();
			}
			p2.score--;
			break;
	}
	powerUpLoc = [null];
	genPower();
}

// Function to handle when a players gets the wall power up
function wall(player) {
	var length;
	switch (player) {
		case 1:
			p1.walling = true;
			length = p1.snake.length;
			break;
		case 2:
			p2.walling = true;
			length = p2.snake.length
			break;
		case 3:
			p3.walling = true;
			length = p3.snake.length;
			break;
	}
	length = Math.floor(length * 1.5);
	wallLoc = [null];

	setTimeout(function() {
		deWall(player, length);
		genWall();
	}, gameSpeed * (length + 1));
}

// Handles clean up after walling is finished.
function deWall(player, length) {
	switch (player) {
		case 1:
			p1.walling = false;
			for (var i = 0; i < length; i++) {
				if (p1.snake.length > 2)
					p1.snake.pop();
			}
			break;
		case 2:
			p2.walling = false;
			for (var i = 0; i < length; i++) {
				if (p2.snake.length > 2)
					p2.snake.pop();
			}
			break;
		case 3:
			p3.walling = false;
			for (var i = 0; i < length; i++) {
				if (p3.snake.length > 2)
					p3.snake.pop();
			}
			break;
	}
}


http.listen(process.env.PORT || 5000, console.log("Listening on *:3001"));