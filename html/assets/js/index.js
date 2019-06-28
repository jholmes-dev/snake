// IO Variable, yay!
var socket = io();

socket.on("render", function(board) {
	render(board[0], board[1], board[2], board[3]);
});
socket.on("star", function(loc) {
	drawBlock(loc[0], loc[1], "yellow");
});

socket.on("player", function(num) {
	$("#pnum").html(num);
	setColor(num);
});

socket.on("num players", function(num) {
	$("#numPlayers").html(num);
});

socket.on("error msg", function(msg) {
	$("#notification").show();
	$("#notification").html(msg);
	setTimeout(function() {
		$("#notification").hide();
	}, 8000);
});

socket.on("score change", function(scores) {
	$("#p1s").html(scores.p1);
	$("#p2s").html(scores.p2);
	$("#p3s").html(scores.p3);
});

function setColor(num) {
	var col = $("#color");
	switch (num) {
		case 1:
			col.css("background-color", "black");
			break;
		case 2:
			col.css("background-color", "green");
			break;
		case 3:
			col.css("background-color", "gray");
			break;
	}
}

$("#start").click(function() {
	socket.emit("start");
});

$("#snek").click(function() {
	$("#canvas").css("background", "url('snek.jpg') center center no-repeat");
	$("#canvas").css("background-size", "cover");
});
	
// Handle directional inuput 
$(window).keydown(function(e) {
	e.preventDefault();
	if (e.keyCode == 40) {
		socket.emit("change direction", "down");
	} else if (e.keyCode == 37) {
		socket.emit("change direction", "left");
	} else if (e.keyCode == 38) {
		socket.emit("change direction", "up");
	} else if (e.keyCode == 39) {
		socket.emit("change direction", "right");
	} else if (e.keyCode == 32) {
		socket.emit("pop end");
	}
})

// Initiate canvas things
var canvas = document.getElementById("canvas"),
	ctx = canvas.getContext("2d"),
	cW = 799,
	cH = 799;

ctx.canvas.width = cW;
ctx.canvas.height = cH;



function render(board, starLoc, powerLoc, wallLoc) {
	console.log("got render");
	ctx.clearRect(0, 0, cW, cH);
	drawBlock(starLoc[0], starLoc[1], "yellow");
	for (var i = 0; i < board.length; i++) {
		for (var j = 0; j < board.length; j++) {
			if (board[i][j] != null) {
				drawBlock(i, j, board[i][j]);
			}
		}
	}

	if (powerLoc[0] != null) {
		drawBlock(powerLoc[0], powerLoc[1], "orange");
	}
	if (wallLoc[0] != null) {
		drawBlock(wallLoc[0], wallLoc[1], "blue");
	}

}

function drawBlock(x, y, color) {
	ctx.fillStyle = color;
	ctx.fillRect(x*20, y*20, 19, 19);
}

socket.on("winner", function(text) {
	ctx.font = "40px sans-serif"
	ctx.fillStyle = "black";
	ctx.clearRect(0, 0, cW, cH);
	ctx.fillText(text, 20, 175);
});

socket.on("reset", function() {
	$("#p1s").html("0");
	$("#p2s").html("0");
	$("#p3s").html("0");
	ctx.clearRect(0, 0, cW, cH);
});

var curDir = 0;
function turnOnAuto() {
	window.setInterval(function() {
		switch (curDir) {
			case 0:
				socket.emit("change direction", "down");
				curDir++;
				break;
			case 1:
				socket.emit("change direction", "left");
				curDir++;
				break;
			case 2:
				socket.emit("change direction", "up");
				curDir++;
				break;
			case 3:
				socket.emit("change direction", "right");
				curDir = 0;
				break;
		}
	}, 800);
}