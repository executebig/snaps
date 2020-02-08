const express = require("express");
const bodyParser = require("body-parser");
const mongodb = require("mongodb");
const ObjectId = require("mongodb").ObjectID;
const crypto = require("crypto");
const Mailgun = require("mailgun-js");

const app = express();
app.use(bodyParser.json());
app.use(
	bodyParser.urlencoded({
		extended: true
	})
);

// Load Environment Variables
require("dotenv").config();

// Mailgun Instance for Verification
const mailgun = new Mailgun({
	apiKey: process.env.MAILGUN_KEY,
	domain: process.env.MAILGUN_DOMAIN
});

// Static Constants
const QUEUE_COLLECTION = "queue";
const SNAPS_COLLECTION = "snaps";
const USERS_COLLECTION = "users";

/* 0. System Setup */

// Reusable database connection
var db;

console.log("Awaiting database connection...");

mongodb.MongoClient.connect(
	process.env.MONGODB_URI || "mongodb://localhost:27017/snaps",
	{
		useUnifiedTopology: true,
		useNewUrlParser: true
	},
	(err, client) => {
		if (err) {
			console.log(err);
			process.exit(1);
		}

		// Save database object from the callback for reuse.
		db = client.db();
		console.log("MongoDB connection ready!");

		// Initialize the app.
		var server = app.listen(process.env.PORT || 3000, () => {
			var port = server.address().port;
			console.log(`Snaps is running on port ${port}.`);
		});
	}
);

// Generic error handler used by all endpoints.
function handleError(res, reason, message, code) {
	console.log("ERROR: " + reason);
	res.status(code || 500).json({ error: message });
}

/* 1. Static Routes */

/*  "/ping"
 *    GET: check status
 */
app.get("/ping", (_, res) =>
	res.json({
		status: 200,
		message: "Pong"
	})
);

/* 2. Operation Routes */

/*  "/snap"
 *    POST: create a new queued snap
 *    PARAMS: url, snaps, email (required)
 */
app.post("/snap", (req, res) => {
	var newSnap = req.body;

	var date = new Date();
	newSnap.createDate = date;

	// cleanup data
	newSnap.snaps = parseInt(newSnap.snaps);
	newSnap.url = lintURL(newSnap.url);

	if (!newSnap.email) {
		return handleError(
			res,
			"Invalid Input",
			"Missing email authentication info.",
			400
		);
	} else if (newSnap.snaps > 50) {
		return handleError(res, "Invalid Input", "Invalid snap count.", 400);
	} else {
		var verificationKey = getVerificationKey(newSnap.email, date);
		newSnap.verificationKey = verificationKey;

		db.collection(QUEUE_COLLECTION).insertOne(newSnap, (err, doc) => {
			if (err) {
				return handleError(
					res,
					err.message,
					"Failed to queue new snap."
				);
			} else {
				res.status(201).json(doc.ops[0]);
				sendVerification(
					newSnap.email,
					doc.ops[0]["_id"],
					verificationKey
				);
			}
		});
	}
});

/*  "/verify"
 *    POST:
 */

app.get("/verify", (req, res) => {
	var id;
	try {
		id = new ObjectId(req.query.id);
	} catch (err) {
		return handleError(res, "Invalid Input", "Queue ID is invalid.", 400);
	}

	db.collection(QUEUE_COLLECTION)
		.find({ _id: id })
		.toArray(function(err, docs) {
			if (err) {
				res.status(400).send(err);
			} else {
				if (docs.length == 0 || docs[0] == undefined) {
					return handleError(
						res,
						"Invalid Input",
						"Queue ID is invalid. Possibly already verified.",
						400
					);
				} else {
					if (docs[0]["verificationKey"] == req.query.key) {
						// success, proceed to migration
						dequeue(res, docs[0]);
					} else {
						// failure, display failure page
						return handleError(
							res,
							"Invalid Input",
							"Verification key is invalid.",
							400
						);
					}
				}
			}
		});
});

/* 3. Services */

function dequeue(res, data) {

    // Register snaps
	db.collection(SNAPS_COLLECTION).updateOne(
		{
			url: data.url
		},
		{
			$inc: {
				snaps: data.snaps
			}
		},
		{ upsert: true }
    );

    // Register a user snapping history
    db.collection(USERS_COLLECTION).updateOne(
        {
            email: data.email
        },
        {
            $push: {
                history: {
                    url: data.url,
                    snaps: data.snaps
                }
            }
        },
        { upsert: true }
    )
    
    // Remove current entry from queue to prevent duplicated dequeue
    db.collection(QUEUE_COLLECTION).remove({ _id: data["_id"] });

    res.send(200);
}

function sendVerification(email, id, key) {
	var verifyURL =
		"https://" + process.env.HOST + "/verify?id=" + id + "&key=" + key;

	var emailData = {
		//Specify email data
		from: process.env.MAILGUN_FROM,
		//The email to contact
		to: email,
		//Subject and text data
		subject: "Verify Your Snaps!",
		html: `\
    <p>Hello,</p>
    <p>Thanks for snapping on my blog! Please click the following link to finalize your clap.</p>\
    <p><strong><a href="${verifyURL}">Click Here</a></strong></p>\
    <br />
    <p>If the above link did not work, please directly visit the URL below:</p>\
    <p>${verifyURL}</p>`
	};

	mailgun.messages().send(emailData, function(err, body) {
		//If there is an error, render the error page
		if (err) {
			console.log("Error sending verification: " + err);
		}
	});
}

/** Generate a unique verification key from email & entry ID */
function getVerificationKey(email, date) {
	var hash = crypto.createHmac("sha512", process.env.SALT);
	hash.update(email + date);

	var key = hash.digest("hex");

	return key;
}

/** Parse URL into a stable & recognizable version */
function lintURL(url) {
	url = new URL(url);

	// only return host + path without trailing slash
	return url.host + url.pathname.replace(/\/+$/, "");
}
