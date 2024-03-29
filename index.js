const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const PORT = 5000;
const cors = require("cors");
const userRoute = require("./loginSignup/user");
require("dotenv").config();

require("./mongoDB/Connection");
const path = require("path");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use("/", userRoute);
const userInfo = require("./mongoDB/UserInfo");
const notification = require("./mongoDB/Notification");
const Conversation = require("./mongoDB/Conversation");
const Message = require("./mongoDB/Message");

app.get("/", (req, res) => {
  res.send("Hello world");
});

//socket io
const socketIO = require("socket.io");
const http = require("http");
const { findById } = require("./mongoDB/UserInfo");
const Group = require("./mongoDB/Group");
const server = http.createServer(app);

const io = socketIO(server, {
  cors: {
    origin: "http://localhost:3000",
  },
});
// const jwt = require('jsonwebtoken');

// Replace this with your actual secret key or read it from an environment variable
// const SECRET_KEY = '1234hello';

// const authenticateUser = (req, res, next) => {
//   const token = req.headers.authorization;

//   if (!token) {
//     return res.status(401).json({ error: 'Unauthorized' });
//   }

//   try {
//     const decodedToken = jwt.verify(token, SECRET_KEY);
//     req.user = decodedToken; // Populate req.user with the decoded token payload
//     next();
//   } catch (err) {
//     return res.status(403).json({ error: 'Invalid token' });
//   }
// };

let onlineUsers = [];
let connectedPeer = [];

const addNewUser = (userId, socketId) => {
  !onlineUsers.some((user) => user.userId === userId) &&
    onlineUsers.push({ userId, socketId });
};

const removeUser = (socketId) => {
  onlineUsers = onlineUsers.filter((user) => user.socketId !== socketId);
};

const getUser = (userId) => {
  return onlineUsers.find((user) => user.userId === userId);
};

io.on("connection", (socket) => {
  //for online users
  console.log("a user connected", socket.id);
  socket.on("clientUsername", (data) => {
    addNewUser(data.userId, socket.id);
    io.emit("clientInfo", onlineUsers);
    console.log("online user is ", onlineUsers);
  });

  socket.on("message", ({ senderId, receiverId, notificationMsg }) => {
    const receiver = getUser(receiverId);
    if (receiver) {
      // io.to(socketIdReceiver).emit("messageFromBack", data);
      io.to(receiver.socketId).emit("messageFromBack", {
        senderId,
        notificationMsg,
        receiverId,
      });
    }
  });

  socket.on("textMessage", ({ sender, receiver, message, senderPeerId }) => {
    const socketIdReceiver = getUser(receiver);
    if (socketIdReceiver) {
      console.log("thisis", message, sender);
      io.to(socketIdReceiver.socketId).emit("textMessageFromBack", {
        sender,
        receiver,
        message,
        senderPeerId,
      });
    }
    // io.to(socketIdReceiver).emit("textMessageFromBack", data);
  });

  // for messages
  socket.on("messageOnly", ({ sender, receiver, message }) => {
    const socketIdReceiver = getUser(receiver);
    if (socketIdReceiver) {
      // Send the message to the receiver's socket ID
      io.to(socketIdReceiver.socketId).emit("messageFromBackOnly", {
        sender,
        receiver,
        message,
      });
    }
  });

  socket.on("twoConnectedPeer", ({ peer1, peer2 }) => {
    connectedPeer.push({ peer1, peer2 });
  });

  //disconnect
  socket.on("disconnect", () => {
    removeUser(socket.id);
    io.emit("clientInfo", onlineUsers);
  });
});

//notification
app.post("/notification", async (req, res) => {
  try {
    const senderId = req.body.senderId;
    const receiverId = req.body.receiverId;
    const notificationMsg = req.body.notificationMsg;

    const notificationInfo = await new notification({
      senderId,
      receiverId,
      notificationMsg,
    }).save();
    res.status(200).json({ notificationInfo });
  } catch (err) {
    console.log(err);
  }
});

//get notification
app.get("/getNotification/:id", async (req, res) => {
  try {
    const n = await notification.find({
      $or: [{ senderId: req.params.id }, { receiverId: req.params.id }],
    });
    res.status(200).json({ n });
  } catch (err) {
    console.log(err);
  }
});

app.get("/deleteNotification/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await notification.deleteMany({ receiverId: id });
  } catch (err) {
    console.log(err);
  }
});

//conversation
//conversation = combo
app.post("/conversation", async (req, res) => {
  try {
    console.log(req.body);

    // Check if a conversation already exists between the two users
    const existingConversation = await Conversation.findOne({
      conversation: { $all: [req.body.senderId, req.body.receiverId] },
    });

    if (existingConversation) {
      // Conversation already exists, indicating they are friends
      return res.status(200).json({ message: "Already friends!" });
    }

    // If the conversation doesn't exist, create a new conversation
    const conversation = new Conversation({
      conversation: [req.body.senderId, req.body.receiverId],
    });
    await conversation.save();

    res.status(200).json({ conversation });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//get all conversation which contains my id
app.get("/conversation/:id", async (req, res) => {
  try {
    const id = req.params.id;
    Conversation.find({ conversation: { $in: [id] } }, (err, result) => {
      if (err) {
        console.log("something went wrong");
      }
      res.status(200).json({ result });
    });
  } catch (err) {
    console.log(err);
  }
});

//for message
//messages
app.post("/messages", async (req, res) => {
  try {
    const messages = new Message(req.body);
    await messages.save();
    res.status(200).json({ messages });
  } catch (err) {
    console.log(err);
  }
});

//get message of conversation of user
app.get("/messagesCombo/:id", async (req, res) => {
  try {
    const id = req.params.id;
    Message.find({ conversationId: id }, (err, result) => {
      if (err) {
        console.log("something went wrong");
      }
      res.status(200).json({ result });
    });
  } catch (err) {
    console.log(err);
  }
});

app.post("/groups", async (req, res) => {
  const { groupName, password } = req.body;

  if (!groupName || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const newGroup = new Group({
    groupName,
    password,
    createdBy: req.params.id, // Assuming req.user contains user information
  });

  await newGroup
    .save()
    .then((group) => {
      res.status(201).json(group); // Return the created group in the response
    })
    .catch((err) => {
      console.error("Error creating group:", err);
      res.status(500).json({ error: "Failed to create group" });
    });
});

//heroku
if (process.env.NODE_ENV === "production") {
  app.use(express.static("messenger/build"));
}

server.listen(process.env.PORT || PORT, (err) => {
  if (err) console.log(err);
  console.log("server is running ", PORT);
});
