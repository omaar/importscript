global.config = require("./config");

// console.log(global.config);

const mongojs = require("mongojs");
const mongo = mongojs(global.config.mongodb.uri, global.config.mongodb.collections);

const csv = require("csvtojson");
const async = require("async");
const crypto = require("crypto");

var all_clients_email = [];
var match_users_email = [];
var all_emails = [];

/*csv()
.fromFile("./all_clients.csv")
.on("json", (row_client) => {
	// console.log(row_client.email);
	var client_emails = row_client.email.split("/ ");

	all_emails = all_emails.concat(client_emails);
})
.on("done", (err) => {
	if (err) throw new Error(err);

	async.series([
		(callback) => {
			mongo.clientes.find(
				{ email: { $exists: true } },
				{ rz: 1, apdl: 1, email: 1 },
			(err, match_clients) => {
				if (err) return callback(err);
				all_emails = match_clients;
				callback();
			});
		},
		(callback) => {
			mongo.users.find(
				{ user: { $in: all_emails || [] } },
			(err, match_users) => {
				if (err) return callback(err);
				match_users_email = match_users;
				callback();
			});
		}
	],
	(err) => {
		if (err) throw new Error(err);
		console.log("Usuarios encontrados: %s", match_users_email.map((user) => { return user.user; }));
		console.log("\n");
		console.log("Usuarios no encontrados: %s", diffArray(all_emails, match_users_email.map((user) => { return user.user; })));
		process.exit();
	});
});*/

async.series([
	(callback) => {
		mongo.clientes.find(
			{ email: { $exists: true } },
			{ rz: 1, apdl: 1, email: 1 },
		(err, match_clients) => {
			if (err) return callback(err);
			match_clients.forEach((client) => {
				client.email = client.email.split("/ ");
			});
			all_clients_email = match_clients;
			callback();
		});
	},
	(callback) => {
		// console.log("All ", all_clients_email)
		/*all_emails = [].concat.apply([], all_clients_email.map((client) => { return client.email }) ) 

		mongo.users.find(
			{ user: { $in: all_emails } },
		(err, match_users) => {
			if (err) return callback(err);
			match_users_email = match_users;
			callback();
		});*/
		async.eachSeries(
			all_clients_email,
			(client, ecallback) => {
				mongo.users.find(
					{ user: { $in: client.email } },
				(err, match_users) => {
					if (err) return callback(err);
					console.log(match_users)
					callback();
				});
			},
		(err) => {
			if (err) return callback(err);
			callback();
		});
	}
],
(err) => {
	if (err) throw new Error(err);
	//console.log("Usuarios encontrados: %s", match_users_email.map((user) => { return user.user; }));
	console.log("\n");
	//console.log("Usuarios no encontrados: %s", diffArray(all_emails, match_users_email.map((user) => { return user.user; }) ));
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