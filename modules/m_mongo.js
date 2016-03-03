// MongoDB Modules
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectId;
var url = ('mongodb://localhost:27017/tictactoe');

// Some Auth Modules
var sha256 = require('js-sha256');
var randomToken = require('random-token').create('abcdefghijklmnopqrstuvwxzyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');



// Function to return a value from the database
// Takes two variables:
// 		coll : The collection to search in
//		query : The query to search for
//		
// Returns a single document that matches the search, or null if no document was found
exports.returnFromDb = function(coll, query, callback) {

	MongoClient.connect(url, function(err, db) {
		assert.equal(null, err);
		
		getDoc(db, function(data) {
			callback(data);
		});		
	});
	
	function getDoc(db, callback) {
		// Find the user in the database
		db.collection(coll).findOne(query, function(err, doc) {
			callback(doc);
			db.close();
		});
		
	}

};



// Function to return all matching documents from db
// Takes three variables:
//		coll: the collection to search in
//		query: the term to search for
//		callback: the callback function
//
// Returns a cursor containing all matching documents on success
exports.getAllFromDb = function(coll, query, callback) {
	
	MongoClient.connect(url, function(err, db) {
		assert.equal(null, err);
		
		db.collection(coll).find(query, function(err, cursor) {
			assert.equal(null, err);

			cursor.toArray(function(err, arr) {
				callback(arr);
				db.close();
			});

		});	
	});
	
};


// Function to create an account
// Takes two variables:
//		user: the username for the account
//		pass: the password for the account
//
// Returns true if user added, else returns false
exports.createAccount = function(user, pass, callback) {
	
	MongoClient.connect(url, function(err, db) {
		assert.equal(null, err);
		
		addAccount(db, function(result) {
			callback(result);
		});
	});
	
	function addAccount(db, callback) {
		// Time to get salty.
		var salt = randomToken(16);
		// Salt n hash them browns
		var hashedPass = sha256(salt + pass);		
		
		// Add the user to the database
		var result = db.collection('users').insert({
			"username": user,
			"password": hashedPass,
			"salt": salt
		}, function(err, result) {
			if (!err)
				callback(true);
			else 
				callback(false);
			db.close();
		});
	}
	
};



// Function to create a match
// Variables:
//		matchTitle: The match title to be created
//		callback: function to call when finished
//
// Returns true on success, false on failure
exports.createMatch = function(matchTitle, host, callback) {
	
	MongoClient.connect(url, function(err, db) {
		assert.equal(null, err);
		
		db.collection('games').insert({
			"_id": matchTitle,
			"host": host,
			"open": false,
			"numPlayers": 0,
			"players": [],
			"pReady": [],
			"pMax": 2,
			"pMin": 2,
			"pTurn": 0,
			"board": [0, 0, 0, 0, 0, 0, 0, 0, 0]
		}, function(err, result) {
			if (err) {
				db.close();
				console.log(err);
				return callback(false);
			}
			else {
				db.close();
				return callback(true);			
			}
		});
		
	});
	
};



// Function to handle join requests for games
// Variables:
//		matchTitle: The title of the match to join
//		playerName: The player who wants to join
//		callback: function to call when done
//
// Callback accepts two arguements, success (false on failure) & message.
exports.joinGame = function(matchTitle, playerName, callback) {

	MongoClient.connect(url, function(err, db) {
		assert.equal(null, err);

		db.collection('games').findOne({ "_id": matchTitle }, function (err, doc) {
			if (err)
				return callback(false, 'Could not connect to database, try again.');
			else if (!doc)
				return callback(false, 'Match does not exist.');
			else if (doc.players.indexOf(playerName) != -1)
				return callback(true);
			else if (doc.numPlayers >= doc.pMax)
				return callback(false, 'Match is full.');
			else {
				db.collection('games').update({ "_id": matchTitle }, {
					$inc: { "numPlayers": 1 },
					$push: { "players": playerName }
				}, function(err, result) {
					if (err)
						return callback(false, 'Could not update database. Try again');
					else
						return callback(true);
				});
			}
		});

	});

};



// Function to remove user from a game
// Variables:
//		matchTitle: the game's title
//		playerName: the player's name
//		callback: calls on complete
//
// Passes success, msg through the callback when completed
exports.removeFromGame = function(matchTitle, playerName, callback) {
	// TODO: if person who left is host, get rid of the game
	MongoClient.connect(url, function(err,db) {
		assert.equal(null, err);

		db.collection('games').findOne({ "_id": matchTitle }, function(err, doc) {
			if (err || !doc)
				return callback(false, 'Could not connect to database, try again.');
			else if (doc.players.indexOf(playerName) == -1)
				return callback(false, '*Faint voice in the background* SHE DOESN\'T EVEN GO HERE. Redirecting you back to the lobby.');
			else {
				// Remove some bitches from the database
				db.collection('games').update({ "_id": matchTitle }, {
					$inc: { "numPlayers": -1 },
					$pull: { "players": playerName },
					$pull: { "pReady": playerName }
				}, function(err, result) {
					if (err) {
						return callback(false, 'Could not update database. Try again');
					}
					else {
						// If there aren't any other players in the game, just delete that shit
						if ((doc.numPlayers - 1) == 0) {
							db.collection('games').remove({
								"_id": matchTitle
							});
						}
						return callback(true);
					}
				});
			}
		});
	});

};



// Function to set a player as ready
// Variables:
//		username: the user's username, ofc
//		game: the player's active game
//		callback: function to callback to
//
// Returns callback, which supports two arguments. success (false on failure), and message.
exports.setReady = function(username, game, callback) {

	MongoClient.connect(url, function(err, db) {
		assert.equal(null, err);

		db.collection('games').findOne({ "_id": game }, function(err, doc) {
			// Make sure they ain't fakin', then add them to the db
			if (err || !doc) {
				return callback(false, 'Could not connect to db.. Try refreshing the page');
			}
			else if (doc.pReady.indexOf(username) != -1) {
				// return callback(false, 'You\'re already ready.');
			}
			else {
				// Add them suckers.
				db.collection('games').update({ "_id": game }, {
					$push: { "pReady": username }
				}, function(err, result) {
					if (err)
						return callback(false, 'Could not update database. Try again');
					else
						return callback(true);
				});
			}
		});
	});
};



// Function to unready a player
// Variables:
//		username: the user's username, ofc
//		game: the player's active game
//		callback: function to callback to
//
// Returns callback, which supports two arguments. success (false on failure), and message.
exports.unsetReady = function(username, game, callback) {

	MongoClient.connect(url, function(err, db) {
		assert.equal(null, err);

		db.collection('games').findOne({ "_id": game }, function(err, doc) {
			// Make sure they ain't fakin', then add them to the db
			if (err || !doc) {
				return callback(false, 'Could not connect to db.. Try refreshing the page');
			}
			else if (doc.pReady.indexOf(username) == -1) {
				return callback(false, 'You\'re already not ready.');
			}
			else {
				// Add them suckers.
				db.collection('games').update({ "_id": game }, {
					$pull: { "pReady": username }
				}, function(err, result) {
					if (err)
						return callback(false, 'Could not update database. Try again');
					else
						return callback(true);
				});
			}
		});
	});
};



// Function to toggle a match's open status
// Variables:
//		game: the game to toggle
//		user: the username of the user making the toggle request
//		callback: function to call when done
//
// When done will do callback function providing the following: (success, msg) *msg is error message on failure, new toggle status on success
exports.toggleOpen = function(game, user, callback) {
	MongoClient.connect(url, function(err, db) {
		assert.equal(null, err);

		db.collection('games').findOne({ "_id": game }, function(err, doc) {
			if (err || !doc) {
				return callback(false, 'Could not connect to db.. Try refreshing the page');
			}
			else if (user != doc.host) {
				return callback(false, 'Only the host can toggle a match\'s open status.');
			}
			else {
				db.collection('games').update({ "_id": game }, {
					$set: { "open": (!doc.open) }
				}, function(err, result) {
					if (err)
						return callback(false, 'Could not update database. Try again');
					else
						return callback(true, (!doc.open));
				});
			}
		});
	});

};



// Function to start a game up
exports.setGameStart = function(game, user, callback) {

	MongoClient.connect(url, function(err, db) {
		assert.equal(null, err);

		db.collection('games').findOne({ "_id": game }, function(err, doc) {
			// Testin some shit
			if (err || !doc) {
				db.close();
				return callback(false, 'Could not connect to db.. Try refreshing the page');
			}
			else if (user != doc.host) {
				db.close();
				return callback(false, 'Only the host can start a match.');
			}
			else if (doc.players.length != doc.pMin) {
				db.close();
				return callback(false, 'Not enough players to start the game.')
			}
			else if (doc.pReady.length != doc.players.length) {
				db.close();
				return callback(false, 'All players must be ready to start the game.')
			}
			else {
				// If alls well, initialize the game
				db.collection('games').update({ "_id": game }, {
					$set: { "active": true, "open": false }
				}, function(err, result) {
					if (err) {
						db.close();
						return callback(false, 'Could not update database. Try again');
					}
					else {
						db.close();
						return callback(true);
					}
				});
			}
		});
	});

}



// Makes a move
// Variables:
//		user: the user making the move
//		game: the game to make the move on
//		sector: the sector of the move
//		callback: called when finished
//
// Returns callback with some info
exports.setMove = function(user, game, sector, callback) {

	MongoClient.connect(url, function(err, db) {
		assert.equal(null, err);

		db.collection('games').findOne({ "_id": game }, function(err, doc) {
			if (err || !doc) {
				db.close();
				return callback(false, 'Match does not exist anymore. We all have to move on sometimes..');
			}
			else if (doc.players[doc.pTurn] != user) {
				db.close();
				return callback(false, 'It\'s not your turn yet... <span class="tiny">Impatient asshole..</span>')
			}
			else if (doc.active != true) {
				db.close();
				return callback(false, 'This game is no longer active.');
			}
			else if (doc.board[sector] != 0){
				db.close();
				return callback(false, 'That move seems pretty illegal. You wouldn\'t be trying to cheat, would you?');
			}
			else {
				// Setup the new board
				doc.board[sector] = (doc.pTurn + 1);
				originalTurn = doc.pTurn;
				if (doc.pTurn == 1)
					doc.pTurn = 0;
				else 
					doc.pTurn = 1;

				// Make le move!
				db.collection('games').update({ "_id": game }, {
					$set: { "board": doc.board,
							"pTurn": doc.pTurn
					}
				}, function(err, result) {
					if (err) {
						db.close();
						return callback(false, 'Could not update database. Try again');
					}
					else {
						db.close();
						return callback(true, null, originalTurn, doc.board);
					}
				});
			}
		});
	});

};



// Closes a match and deletes it from the database
// Variables:
//		game: the game to delete
//
// No return
exports.closeMatch = function(game) {

	MongoClient.connect(url, function(err, db) {
		assert.equal(null, err);

		db.collection('games').deleteOne({ "_id": game }, function() {
			db.close();
			return;
		});
	});

}