const path = require("node:path");
const express = require("express");
const config = require("./config");
const { createApp } = require("./app");

const app = createApp();
// the same process also serves the static site (client/), so one Hostinger app is enough
app.use(express.static(path.join(__dirname, "..", "client"), { extensions: ["html"] }));
app.get("/robots.txt", (req, res) => res.type("text/plain").send("User-agent: *\nDisallow: /\n"));

app.listen(config.port, () => console.log(`Malaconda on ${config.baseUrl} (port ${config.port})`));
