// We don't really need any modules for this... WEW.
// TODO: Add user tokens to the connected user database and check them to prevent duplicate token use

// Array of connected users
var connUsers = [];


// Returns the connect users array
// No Variables
//
// Just returns the connUsers array
exports.getUsersArray = function() {
	return connUsers;
}



// Adds a connected user to the array
// Variables:
//		username: the user's username
//		socket: the user's socket
//
// No return
exports.addConnUser = function (username, socket) {
	connUsers.push({ 
		"socket": socket,
		"username": username	
	});
	console.log(connUsers);
}



// Removes a connected user from the array
// Variable:
//		socket: the socket of the user to remove
//
// No return
exports.removeConnUser = function (socket) {
	var removeIndex = null;
	// Loops through the logged in users list until the disconnected socket is found, then it is removed
	for (var i = 0; i<connUsers.length; i++) {
		if (connUsers[i].socket == socket) {
			removeIndex = i;
			break;
		}
	}
	// If a user was found, remove him from the array
	// If a user wasn't found, something went wrong in the array, look for and clean up orphan users
	if (removeIndex != null) {
		connUsers.splice(removeIndex, 1);
	}
	else {
		this.cleanOrphans();
	}
	
}



// Handles retrieval of a user from the connected users array
// Vairable:
//		socket: the user's socket
//
// Returns the username of the user realted to given socket
exports.getUser = function (socket) {
	var returnIndex = null;
	// Loops through the logged in users list until the disconnected socket is found, then its username returned
	for (var i = 0; i<connUsers.length; i++) {
		if (connUsers[i].socket == socket) {
			returnIndex = i;
			break;
		}
	}
	//console.log(connUsers[returnIndex]);
	if (connUsers[returnIndex])
		return connUsers[returnIndex].username;
	else
		return false;
}



// Checks if a user is connected
// Variable:
//		username: the user's username to check for
//
// Returns true if user is found, else no return happens
exports.isConnected = function (username) {
	var returnIndex = null;
	// Loops through the logged in users, if username is found, returns true
	for (var i = 0; i<connUsers.length; i++) {
		if (connUsers[i].username == username) {
			return true;
		}
	}
}



// Function to get a list of users in a namespace
// Variable:
//		ns: the namespace to retrieve connected sockets from
//
// Returns an array of usernames connected with the provided sockets
exports.getUsersFromId = function(ns) {
	var users = [];
	for (var i = 0; i < ns.length; i++) {
		users.push(this.getUser(ns[i]));
	}
	return users;
}
exports.getUsers = function(ns, room) {
	var res = [];

	if (room) 
		res = Object.keys(ns.adapter.rooms[room]);
	else {
	    for (var id in ns.connected) {
	        res.push(ns.connected[id].id);
	    }
	}
    return this.getUsersFromId(res);
}



// In progress..
exports.cleanOrphans = function () {
	// TODO: Cleanup orphan logins
	// Gonna need to get the io for this
	console.log('orphans would be cleaned');
	// for (socketid in io.sockets.connected) {
	// 	console.log(socketid);
	// }
}