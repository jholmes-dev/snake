// Get some spicy modules up in huzzah.
var m_login = require('./m_login');
var m_mongo = require('./m_mongo');
var m_sh = require('./m_socket_handler');
var jwt = require('jsonwebtoken');
var pKey = require('./m_key.js');


// Function to send out initialization on connection
exports.init = function(io, socket, game) {
	// This is gonna return game data for setup on client side
	m_mongo.returnFromDb('games', { "_id": game }, function(doc) {
		if (doc) {
			io.to(socket).emit('init', {
				"p1": doc.players[0],
				"p2": doc.players[1],
				"pTurn": doc.pTurn,
				"board": doc.board
			});
		}
		else {
			// Something went wrong. ALERT THE MEDIA.
			io.to(socket).emit('validation error', { 
				"msg": 'These are not the droids you\'re looking for (Match does not exist) - Try logging in again.',
				"url": '/'
			});
		}
	});
};



// Function to handle making a move
// Variables:
//		io: io to emit to
//		socket: the socket id of the client making the request
//		data:
//			.token: the client's auth token
//			.sector: the sector to make a move on
//
// Handles client directly
exports.makeMove = function(io, socket, data) {
	// Verification is life, verification is love.
	jwt.verify(data.token, pKey(), function(err, decoded) {
		if (err) {
			// Something went horribly wrong
			io.to(socket).emit('validation error', {
				"msg": 'We couldn\'t authenticate your token. Try logging in again.',
				"url": '/'
			});
		}
		else if (data.sector >= 0 && data.sector <= 8) {
			// Attempt to make the move
			m_mongo.setMove(decoded.username, decoded.activeGame, data.sector, function(success, msg, turn, board) {
				if (success) {
					// Move was made successfully, update the room, and check for sweet, sweet victory.
					io.to(decoded.activeGame).emit('move made', {
						"pTurn": turn,
						"sector": data.sector
					});
					// Check victory
					checkVictory(board, function(data) {
						io.to(decoded.activeGame).emit('game over', {
							"victor": data
						});					
						// Close the match
						m_mongo.closeMatch(decoded.activeGame);
					});
				}
				else {
					// Bad stuff happens
					io.to(socket).emit('error', { "msg": msg });
				}
			});
		}
	});
};



// Function to check if victory/stalemate has been had.
checkVictory = function(board, callback) {
	if (((board[0] == board[1] == board[2]) || (board[0] == 2 && board[1] == 2 && board[2] == 2)) && board[0] != 0 && board[1] != 0 && board[2] != 0) {
		return callback(board[0]);
	}
	else if (((board[3] == board[4] == board[5]) || (board[3] == 2 && board[4] == 2 && board[5] == 2)) && board[3] != 0 && board[4] != 0 && board[5] != 0) {
		return callback(board[3]);
	}
	else if (((board[6] == board[7] == board[8]) || (board[6] == 2 && board[7] == 2 && board[8] == 2)) && board[6] != 0 && board[7] != 0 && board[8] != 0) {
		return callback(board[6]);
	}
	else if (((board[0] == board[3] == board[6]) || (board[0] == 2 && board[3] == 2 && board[6] == 2)) && board[0] != 0 && board[3] != 0 && board[6] != 0) {
		return callback(board[0]);
	}
	else if (((board[1] == board[4] == board[7]) || (board[1] == 2 && board[4] == 2 && board[7] == 2)) && board[1] != 0 && board[4] != 0 && board[7] != 0) {
		return callback(board[1]);
	}
	else if (((board[2] == board[5] == board[8]) || (board[2] == 2 && board[5] == 2 && board[8] == 2)) && board[2] != 0 && board[5] != 0 && board[8] != 0) {
		return callback(board[2]);
	}
	else if (((board[0] == board[4] == board[7]) || (board[0] == 2 && board[4] == 2 && board[7] == 2)) && board[0] != 0 && board[4] != 0 && board[7] != 0) {
		return callback(board[0]);
	}
	else if (((board[2] == board[4] == board[6]) || (board[2] == 2 && board[4] == 2 && board[6] == 2)) && board[2] != 0 && board[4] != 0 && board[6] != 0) {
		return callback(board[2]);
	}
	else if (board.indexOf(0) == -1) {
		return callback(0);
	}
};



exports.leaveActiveGame = function(io, socket, token) {
	// Start with verification as usual
	jwt.verify(token, pKey(), function(err, decoded) {
		if (err) {
			io.to(socket).emit('validation error', {
				"msg": 'Error validating you session token. Try logging in again',
				"url": '/'
			});
		}
		else {
			// Get this man a new token, and redirect him back to the lobby. Also alert his game that he left.
			var room = decoded.activeGame;
			decoded.activeGame = null;
			jwt.sign(decoded, pKey(), { "expiresIn": "1 day" }, function(newToken) {
				io.to(socket).emit('leave game', {
					"newToken": newToken,
					"msg": 'Redirecting you back to the lobby, you quitter.',
					"url": '/lobby'
				});
				io.to(room).emit('player left', {
					"msg": decoded.username + ' has left the game. He probably had something to do. <span class="tiny">Or he\'s just a massive asshole.</span><br/>Redirecting you back to the lobby.',
					"user": decoded.username
				});
				m_mongo.closeMatch(room);
				return;
			});
		}
	});
};