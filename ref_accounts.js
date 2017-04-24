global.config = require("./config");

// console.log(global.config);

const mongojs = require("mongojs");
const mongo = mongojs(global.config.mongodb.uri, global.config.mongodb.collections);

const csv = require("csvtojson");
const async = require("async");
const crypto = require("crypto");

var all_clients = [];
var match_users = [];
var all_emails = [];

async.series([
	(callback) => {
		console.log("Buscando Clientes...");
		mongo.clientes.find(
			{ email: { $exists: true } },
			{ rz: 1, apdl: 1, email: 1 },
		(err, match_clients) => {
			if (err) return callback(err);
			match_clients.forEach((client) => {
				client.email = client.email.split("/ ");
			});
			all_clients = match_clients;
			callback();
		});
	},
	(callback) => {
		console.log("Buscando Usuarios...");
		async.eachSeries(
			all_clients,
			(client, ecallback) => {
				mongo.users.find(
					{ user: { $in: client.email } },
					{ _id: 1, user: 1 },
				(err, users) => {
					if (err) return ecallback(err);
					if (users.length) {
						users.forEach((user) => {
							user.ide = client._id;
						});
						console.log("Usuarios: ", users);
						match_users = match_users.concat(users);
					}
					ecallback();
				});
			},
		(err) => {
			if (err) return callback(err);
			callback();
		});
	},
	(callback) => {
		/*console.log("Usuarios que coincidieron...");
		console.log(match_users);*/
		//callback();
		console.log("Actualizando Usuarios...");
		async.eachSeries(
			match_users,
			(user, ecallback) => {
				mongo.users.update(
					{ _id: user._id },
					{ $set: { ide: user.ide } },
				(err, updt_user) => {
					if (err) return ecallback(err);
					console.log("Usuario: %s, Cliente: %s", user._id, user.ide);
					ecallback();
				});
			},
		(err) => {
			if (err) return callback(err);
			console.log("Usuarios Actualizandos!");
			callback();
		});
	}
],
(err) => {
	if (err) throw new Error(err);
	// console.log("Usuarios encontrados: %s", match_users_email.map((user) => { return user.user; }));
	console.log("\n");
	// console.log("Usuarios no encontrados: %s", diffArray(all_emails, match_users_email.map((user) => { return user.user; }) ));
	process.exit();
});

function diffArray(prev, next) {
	return prev
		.filter(el => !next.includes(el))
		.concat(
			next.filter(el => !prev.includes(el))
		)
};

if (!Array.prototype.includes) {
  Array.prototype.includes = function(searchElement /*, fromIndex*/ ) {
	'use strict';
	var O = Object(this);
	var len = parseInt(O.length) || 0;
	if (len === 0) {
	  return false;
	}
	var n = parseInt(arguments[1]) || 0;
	var k;
	if (n >= 0) {
	  k = n;
	} else {
	  k = len + n;
	  if (k < 0) {k = 0;}
	}
	var currentElement;
	while (k < len) {
	  currentElement = O[k];
	  if (searchElement === currentElement ||
		 (searchElement !== searchElement && currentElement !== currentElement)) {
		return true;
	  }
	  k++;
	}
	return false;
  };
};