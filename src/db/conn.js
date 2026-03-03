const mongoose = require('mongoose');
require('dotenv').config();

mongoose.set("strictQuery", false);
const conn_string = process.env.CONN_STRING;

if (!conn_string) {
    console.error('ERROR: CONN_STRING environment variable is not set!');
    console.error('Please set CONN_STRING in your .env file or environment variables.');
    process.exit(1);
}

mongoose.connect(conn_string, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    autoIndex: true,
}).then(() => {
    console.log('Connected to database!!');
}).catch((e) => {
    console.error(`Database connection failed: ${e.message}`);
    // Don't exit process - allow server to run without DB for development
    // process.exit(1);
});
