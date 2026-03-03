/******************************************************
 * MAIN APPLICATION ENTRY POINT
 ******************************************************/

const express = require("express");
const path = require("path");

// Import database connection
require("./db/conn");

// Import services
const { startDeviceStatusService } = require("./services/deviceStatusService");

// Import routes
const deviceRoutes = require("./routers/device");
const testRoutes = require("./routers/test");
const healthRoutes = require("./routers/health");
const logsRoutes = require("./routers/logs");
const dashboardRoutes = require("./routers/dashboard");

// Initialize Express app
const app = express();

/******************************************************
 * APP CONFIGURATION
 ******************************************************/
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// Handlebars helpers
const hbs = require("hbs");
hbs.registerHelper("formatDate", (date) => {
  if (!date) return "Never";
  return new Date(date).toLocaleString();
});

/******************************************************
 * ROUTES
 ******************************************************/
app.use("/", dashboardRoutes);
app.use("/device", deviceRoutes);
app.use("/test", testRoutes);
app.use("/health", healthRoutes);
app.use("/logs", logsRoutes);

/******************************************************
 * START SERVER (Render Compatible)
 ******************************************************/
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`ESP32 Proxy running on port ${PORT}`);
  
  // Start background services
  startDeviceStatusService();
});

/******************************************************
 * GRACEFUL SHUTDOWN
 ******************************************************/
const mongoose = require("mongoose");
const { stopDeviceStatusService } = require("./services/deviceStatusService");

function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  // Stop background services
  stopDeviceStatusService();
  
  // Close server
  server.close(() => {
    console.log("HTTP server closed");
    
    // Close MongoDB connection
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed");
      process.exit(0);
    });
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
