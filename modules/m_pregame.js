// This is the file for handleing pregame requests
// Gonna need a few of these modules
var m_login = require('./m_login');
var m_mongo = require('./m_mongo');
var m_sh = require('./m_socket_handler');
var jwt = require('jsonwebtoken');
var pKey = require('./m_key.js');

// Now the fun may begin:

// Function to handle pregame connections
// Variables:
//		io: the main socket to blast to
//		token: the user's auth token, contains variables after decryption
//			.username: the user's username
//			.activeGame: user's active game, if there is one
//		socket: the user's socket
//		callback: the callback function
//
// Returns two varibles in the callback, success (true on success), and the new room name to connect the user to
exports.connect = function(io, username, activeGame, socket, callback) {
	// Attempt to join the match
	m_mongo.joinGame(activeGame, username, function(success, msg) {
		if (success) {
			m_mongo.returnFromDb('games', { "_id": activeGame }, function(doc) {
				if (doc.active == true) {
					io.to(socket).emit('game started', {
						"msg": 'Your game has already started, sending you there now..',
						"url": '/game'
					});
					return false;
				}
				else {
					return callback(true, activeGame);
				}
			});
		}
		else {
			activeGame = null;
			jwt.sign({
				"username": username,
				"activeGame": activeGame 
			}, pKey(), { "expiresIn": "1 day" }, function(token) {
				if (!token) {
					io.to(socket).emit('validation error', {
						"msg": 'Something horrible went wrong.. Try logging in again',
						"url": '/'
					});
				}
				else {
					io.to(socket).emit('join error', {
						"msg": msg,
						"url": '/lobby',
						"token": token
					});
				}
				//return callback(false);
			});
		} // End of failed join

	}); // End of mongo connection

}; // End of function.



// Returns an array of players who are ready in a pregame lobby
// Variables:
//		game: the game name
//		callback: function to callback when finished
//
// Returns a callback containing either the data or false (on failure)
exports.getReadyPlayers = function(game, callback) {
	m_mongo.returnFromDb('games', { "_id": game }, function(doc) {
		if (doc != null) {
			return callback(doc.pReady);
		}
		else {
			return callback(false);
		}
	});
};



// Function to ready a player in a match
// Variables:
// 		io: the io to emit on
//		socket: the client's socket
//		token:
//			.username: the client's username
//			.activeGame: the client's active (and current) game
//		callback: function to call when finished
//
// Callback function called with the following params: success, message, activeGame
exports.readyPlayer = function(io, socket, token, callback) {
	// As always, verify a motherfucker.
	jwt.verify(token, pKey(), function(err, decoded) {
		if (err) {
			io.to(socket).emit('validation error', {
				"msg": 'Your session token is invalid, try logging in again.',
				"url": '/'
			});
		}
		else {
			m_mongo.setReady(decoded.username, decoded.activeGame, function(success, msg) {
				callback(success, msg, decoded.activeGame);
			});
		}
	});
};



// Function to unready a player - This function is completely worthless and I should have saved space by making this a single toggle function
// Variables:
// 		io: the io to emit on
//		socket: the client's socket
//		token:
//			.username: the client's username
//			.activeGame: the client's active (and current) game
//		callback: function to call when finished
//
// Callback function called with the following params: success, message, activeGame
exports.unreadyPlayer = function(io, socket, token, callback) {
	// Dat verification, yo.
	jwt.verify(token, pKey(), function(err, decoded) {
		if (err) {
			io.to(socket).emit('validation error', {
				"msg": 'Your session token is invalid, try logging in again.',
				"url": '/'
			});
		}
		else {
			m_mongo.unsetReady(decoded.username, decoded.activeGame, function(success, msg) {
				callback(success, msg, decoded.activeGame);
			});
		}
	});
};



// Toggles a match open or closed
// Variables:
//		io: the pregame io to emit to
//		socket: the user's socket
//		token: the user's token
//		lobby: used to emit that a game has been open or closed
//
// No return, handles client directly.
exports.toggleMatchOpen = function(io, socket, token, lobby) {
	// Ain't gettin through without a verify.
	jwt.verify(token, pKey(), function(err, decoded) {
		if (err) {
			io.to(socket).emit('validation error', {
				"msg": 'Your session token is invalid. Try logging in again.',
				"url": '/'
			});
		}
		else {
			m_mongo.toggleOpen(decoded.activeGame, decoded.username, function(success, msg) {
				if (success) {
					io.to(socket).emit('open status', msg);
					m_sh.getGames(lobby);
				}
				else {
					io.to(socket).emit('error', { "msg": msg });
				}
			});
		}
	});
};



// Function to handle leaving a pregame lobby
// Variables:
//		io: the pregame io to emit to
//		socket: the user's socket
//		token: the user's token
//		lobby: the lobby io to emit game changes to
//
// No return, handles client directly
exports.leaveGame = function(io, socket, token, lobby) {
	// Verify some shiznit
	jwt.verify(token, pKey(), function(err, decoded) {
		if (err) {
			io.to(socket).emit('validation error', {
				"msg": 'Your session token is invalid. Try logging in again.',
				"url": '/'
			});
		}
		else {
			// Remove them from the game. Scrubz - amirite?
			m_mongo.removeFromGame(decoded.activeGame, decoded.username, function(success, msg) {
				if (success) {
					// if done right, send the user a new token and redirect him
					var room = decoded.activeGame;
					decoded.activeGame = null;
					jwt.sign(decoded, pKey(), { "expiresIn": "1 day" }, function(newToken) {
						io.to(socket).emit('leave game', {
							"newToken": newToken,
							"msg": 'Redirecting you back to the lobby, you quitter.',
							"url": '/lobby'
						});
						io.to(room).emit('user left', decoded.username);
						m_sh.getGames(lobby);
						return;
					});
				}
				else {
					// If shit hits the fan, let the user know.
					io.to(socket).emit('error', { "msg": msg });
					return;
				}
			});
		}
	});
}



// Function to handle starting a game
// Variables:
//		io: the pregame io to emit to
//		socket: the user's socket
//		token: the user's token
//		lobby: the lobby io to emit game changes to
//
// No return, handles client directly
exports.startGame = function(io, socket, token, lobby) {
	// Start with some token verification, who saw that one coming?
	jwt.verify(token, pKey(), function(err, decoded) {
		if (err) {
			io.to(socket).emit('validation error', {
				"msg": 'Your session token is invalid. Try logging in again.',
				"url": '/'
			});
		}
		else {
			// Get mongo to start the game
			m_mongo.setGameStart(decoded.activeGame, decoded.username, function(success, msg) {
				if (success) {
					// If it worked, send a redirect order to all!
					io.emit('game started', {
						"msg": 'Game has been started, redirecting you..',
						"url": '/game'
					});
					m_sh.getGames(lobby);
				}
				else {
					// If shit hits the fan, let the user know.
					io.to(socket).emit('error', { "msg": msg });
					return;
				}
			});
		}
	});
};