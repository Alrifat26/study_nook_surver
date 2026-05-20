const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// MongoDB Connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

// Auth Middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
    if (error) return res.status(401).send({ message: "Unauthorized Access" });
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // await client.connect();
    const db = client.db("studyNookDB");
    const roomsCollection = db.collection("rooms");
    const bookingsCollection = db.collection("bookings");
    const usersCollection = db.collection("users");

    console.log("MongoDB Connected Successfully");

    // Default Route
    app.get("/", (req, res) => res.send("StudyNook Server Running Perfectly!"));

    // --- Auth Routes ---
    app.post("/users", async (req, res) => {
      const userData = req.body;
      const existing = await usersCollection.findOne({ email: userData.email });
      if (existing) return res.send({ message: "User exists" });
      const result = await usersCollection.insertOne(userData);
      res.send(result);
    });

    app.post("/login", async (req, res) => {
      const { email, password } = req.body;
      const user = await usersCollection.findOne({ email });
      if (!user) return res.status(401).send({ message: "User not found" });
      if (user.password !== password) return res.status(401).send({ message: "Invalid password" });
      
      const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: "1d" });
      res.cookie("token", token, { httpOnly: true }).send({ success: true, token, user });
    });

    // --- Room Routes ---
    app.get("/rooms", async (req, res) => {
      const result = await roomsCollection.find().toArray();
      res.send(result);
    });

    app.get("/rooms/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const room = await roomsCollection.findOne(query);
      res.send(room);
    });

    app.post("/rooms", verifyToken, async (req, res) => {
      const roomData = { ...req.body, ownerEmail: req.user.email, createdAt: new Date() };
      const result = await roomsCollection.insertOne(roomData);
      res.send(result);
    });

    // --- Bookings Route ---
    app.post("/bookings", verifyToken, async (req, res) => {
      const bookingData = { ...req.body, userEmail: req.user.email, createdAt: new Date() };
      const result = await bookingsCollection.insertOne(bookingData);
      res.send(result);
    });

    app.get("/my-bookings", verifyToken, async (req, res) => {
      const email = req.user.email;
      const result = await bookingsCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });

    app.get("/my-listings", verifyToken, async (req, res) => {
      const email = req.user.email;
      const result = await roomsCollection.find({ ownerEmail: email }).toArray();
      res.send(result);
    });

  } finally { }
}

run().catch(console.dir);
app.listen(port, () => console.log(`Server running on port ${port}`));