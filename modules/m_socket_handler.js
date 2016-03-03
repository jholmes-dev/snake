// Some Modules, yo.
var m_login = require('./m_login');
var m_mongo = require('./m_mongo');
var jwt = require('jsonwebtoken');
var pKey = require('./m_key.js');


// Function to handle login attempt
// Takes two variables:
//		io: socket.io connection to push data through
//		data: login data from the client
//
// No return, communicates with the client directly
exports.login = function(io, data) {
	// Token returns null on failed login attempt, else it returns a signed token for future use
	m_login(data.username, data.password, function(token) {
		
		// Handle what we pass back.
		if (!token) {
			io.to(data.socket).emit('error', 'Username or Password are incorrect');
		}			
		else  { 
			io.to(data.socket).emit('login', {
				"token": token,
				"username": data.username,
				"url": '/lobby'
			});
		}
	
	});
};



// Function to handle account creation
// Takes two variables:
//		io: socket.io connection to push data through
//		data: account creation data from the client
//
// No return, communicates with the client directly
exports.createAccount = function(io, data) {
	// We'll start by making sure the username doesn't contain anything illegal
	var usrErr = checkUsername(data.username, data.password);
	if (usrErr)
		return io.to(data.socket).emit('error', usrErr);
		

	// Query the db to see if user exists already
	m_mongo.returnFromDb('users', {
		"username": data.username
	}, function(user) {
				
		if (user) {
			io.to(data.socket).emit('error', 'Username is taken');
		}
		else {
			// Query the db to create an account
			m_mongo.createAccount(data.username, data.password, function(response) {
				if (response) {
					io.to(data.socket).emit('create account', {
						"status": "true",
						"redirect": "/"
					});
				}
				else {
					io.to(data.socket).emit('error', 'Something went wrong. Try again later.');
				}
			});
		}
		
	});
	
	// Function to check if user data is correct
	function checkUsername(username, password) {
		if (/^[a-zA-Z0-9-s]*$/.test(username) == false) 
			return 'Special characters aren\'t allowed in usernames';
		if (username.length <= 3)
			return 'Usernames need to be at least 4 characters long';
		if (username.length > 16)
			return 'Username may be no longer than 16 characters';
		if (password.length <= 4)
			return 'Passwords need to be at least 5 characters long';
	}
	
};



// This function verifys a received token
// Takes two variables:
//		io: the socket to send responses to
//		data: 
//			.token: user's auth token
//		socket: user's socket, yo.
//
// Retruns true on successful verification Sends error message to client on fail
exports.verifyToken = function(io, token, socket, callback) {
	// Start by verifying the token
	jwt.verify(token, pKey(), function(err, decoded) {
		if (err) {
			console.log(err);
			io.to(socket).emit('validation error', {
				"msg": 'It seems you don\'t belong here, you should try logging in again.',
				"url": '/'
			});
			return false;
		} else {

			return callback(decoded.username, decoded.activeGame);
		}
			
	});
	
};



// Function to handle retrieval of open games
// Input:
//		io: socket to respond to client on
//
// Sends list of open games back to client in json format
exports.getGames = function(io, socket) {
	m_mongo.getAllFromDb('games', { "open": true }, function(games) {
		if (socket) 
			io.to(socket).emit('get games', games);
		else
			io.emit('get games', games);
	});
};


// Function to handle broadcasting games
// Variable:
//		io: the io to broadcast to
//
// No return, just sends games out, yo.
exports.sendGames = function(io) {
	m_mongo.getAllFromDb('games', { "open": true }, function(games) {
		io.emit('get games', games);
	});
}



// This function handles incoming chat messages
// Two inputs:
//		io: the public socket to communicate to
//		data:
//			.message: the chat message from the client
//			.token: the client's token for verification
//		socket: the client's socket id
//
// No return, sends out chat message to clients directly
exports.chat = function(io, data, socket) {
	// We'll start by verifying this man's token.
	jwt.verify(data.token, pKey(), function(err, decoded) {
		if (err) {
			console.log(err);
			io.to(socket).emit('validation error', {
				"msg": 'We couldn\'t validate your request, sorry brah. Try logging in again.',
				"url": '/'
			});
			return;
		}
		// If he passed the true test, we shall allow passage of his message to thine peers.
		if (decoded.activeGame != null) {
			io.to(decoded.activeGame).emit('chat message', {
				"user": decoded.username,
				"message": data.message
			});
		}
		else {
			io.emit('chat message', {
				"user": decoded.username,
				"message": data.message
			});
		}
	});
};



// This functions handles requests to create/host matches
// Variables:
//		io: the public socket to communicate with
//		data:
//			.matchTitle: the game's match title
//			.token: the user's auth token
//		socket: the user's socket id
//		callback: to be called on complete
//
// Returns a new token on success, false on failure
exports.createGame = function(io, data, socket, callback) {
	// Verify le token, as always, don't want no unwanteds issuin commands up in huzzah.
	jwt.verify(data.token, pKey(), function(err, decoded) {
		if (err) {
			console.log(err);
			io.to(socket).emit('error', { "msg": 'Oh god... Something went terribly wrong. Try again later.' });
			return callback(false);
		}
		
		// Check the match title
		var checkTitle = checkMatchTitle(data.matchTitle);
		if (checkTitle) {
			io.to(socket).emit('error', { "msg": checkTitle });
			return callback(false);
		}

		// Create a match
		m_mongo.createMatch(data.matchTitle, decoded.username, function(success) {
			// If it worked, get the user a new token
			if (success) {
				decoded.activeGame = data.matchTitle;
				jwt.sign(decoded, pKey(), { expiresIn: '1 day' }, function(token) {
					return callback(token);
				});
			}
			else {
				io.to(socket).emit('error', { "msg": 'Couldn\'t create match, this is usually because the match name is already taken. Try again with a different name.' });
				return callback(false);
			}
		});
	});

	// Function to check if user data is correct
	function checkMatchTitle(matchTitle) {
		if (!matchTitle)
			return 'You gotta enter something, m8.';
		if (/^[a-zA-Z0-9-s]*$/.test(matchTitle) == false) 
			return 'Special characters aren\'t allowed in match title';
		if (matchTitle.length < 3)
			return 'Match title needs to be at least 3 characters long';
		if (matchTitle.length > 16)
			return 'Match title may be no longer than 16 characters';
		return false;
	}

};



// Function to put a user into a game
// Variables:
//		io: io to communicate with
//		socket: user's socket
//		data:
//			.token: user's auth token
//			.matchTitle: match to join
//
// No output, handles client itself
exports.joinGame = function(io, socket, data) {
	// Verify some shit in the shit
	jwt.verify(data.token, pKey(), function(err, decoded) {
		if (err) {
			io.to(socket).emit('validation error', {
				"msg": 'Could not validate your session, please try logging in again.',
				"url": '/'
			});
		}
		else {
			// Put player into game if token checks out
			m_mongo.joinGame(data.matchTitle, decoded.username, function (success, msg) {
				if (success) {
					// Send the player the new token
					decoded.activeGame = data.matchTitle;
					jwt.sign(decoded, pKey(), { expiresIn: '1 day' }, function(token) {
						io.to(socket).emit('join game', {
							"newToken": token,
							"url": '/pregame',
							"msg": 'Your game is ready! Redirecting you now...'
						});
					});
				}
				else {
					// Send player an error message if shit hits the fan
					io.to(socket).emit('error', { "msg": msg });
				}
			});
		}
	});
};