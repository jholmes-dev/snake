// Some Auth Modules
var jwt = require('jsonwebtoken');
var sha256 = require('js-sha256');
var pKey = require('./m_key.js');

// DB Module
var mongo = require('./m_mongo.js');


// Here we're going to take the passed login information and check it against our database
// If the login is successfull we'll pass back an auth token, if it fails we'll pass back false :(
module.exports = function(user, pass, callback) {
	
	mongo.returnFromDb('users', {
		"username": user
	}, function(doc) {

		if (doc == null) {
			console.log("Username not found in db");
			return callback(false);
		}
		
		// If user exists, match his password
		var saltedPass = sha256(doc.salt + pass);
		
		if (saltedPass != doc.password) {
			console.log("Password incorrect");
			return callback(false);
		}
		
		// Create the token and pass it back
		jwt.sign({
			"username": doc.username,
			"activeGame": null
		}, pKey(), { expiresIn: '1 day' }, function(token) {
			return callback(token);
		});
	
	});

};
