// src/index.js
const express = require("express");
const app = express();
const path = require("path");

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const seedDummyData = require("./db/dummyData");
seedDummyData();

app.use("/", require("./routers/dashboard.router"));
app.use("/api", require("./routers/api.router"));
app.use("/device", (req, res) => {console.log("here.....")}, require("./routers/device.router"));

app.get("/health", (_, res) => res.send("OK"));

const PORT = 3000;
app.listen(PORT, () =>
  console.log(`ESP32 Proxy running on http://localhost:${PORT}`)
);
