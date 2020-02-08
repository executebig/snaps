const airtable = require("airtable")
const express = require("express")
const app = express()

// Load Environment Variables
require("dotenv").config()

const port = process.env.port || 3000

app.listen(port, () => console.log(`Snaps is running on port ${port}.`))

app.get("/ping", (_, res) => res.sendStatus(200))

// Post new snaps to server
app.post("/snap", (req, res) => {

})