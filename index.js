const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const PORT = 5000;
const cors = require("cors");
const userRoute = require("./loginSignup/user");
require("dotenv").config();

const crypto = require('crypto');
//for message
const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); 
const iv = crypto.randomBytes(16); 

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
const authenticate = require("./middleware");
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

  socket.on("textMessage", ({ sender, receiver, message, senderPeerId, callType }) => {
    const socketIdReceiver = getUser(receiver);
    if (socketIdReceiver) {
      console.log("thisis", message, sender);
      io.to(socketIdReceiver.socketId).emit("textMessageFromBack", {
        sender,
        receiver,
        message,
        senderPeerId,
        callType,
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

  //group io code
  // Event handler for joining a group
  socket.on("joinGroup", async ({ groupId }) => {
    try {
      // Join the room corresponding to the group ID
      socket.join(groupId);
      console.log(`Socket ${socket.id} joined group room ${groupId}`);
    } catch (error) {
      console.error("Error joining group room:", error);
    }
  });

  // Function to send message to a group
  const sendMessageToGroup = async (groupId, { senderId, message }) => {
    console.log("sendMessageToGroup", groupId, senderId, message);
    try {
      // Emit the message to the group room
      io.to(groupId).emit("groupMessageFromBack", {
        groupId,
        senderId,
        message,
      });
    } catch (error) {
      console.error("Error sending message to group:", error);
    }
  };

  // Event handler to handle group messages
  socket.on("groupMessage", async ({ groupId, senderId, message }) => {
    // Call function to send message to the group
    await sendMessageToGroup(groupId, { senderId, message });
  });

  // Event handler for leaving a group
  socket.on("leaveGroup", async ({ userId, groupId }) => {
    try {
      // Leave the room corresponding to the group ID
      socket.leave(groupId);
      socket.to(groupId).emit("groupMemberLeft", {
        groupId,
        userId,
        message: `${userId} has left the group`,
      });
      console.log(`Socket ${socket.id} left group room ${groupId}`);
    } catch (error) {
      console.error("Error leaving group room:", error);
    }
  });

  socket.on("hangup-call", ({receiverId})=>{
     console.log("hitted hangup", receiverId)
     const socketIdReceiver = getUser(receiverId);
    if (socketIdReceiver) {
      // Send the message to the receiver's socket ID
      io.to(socketIdReceiver.socketId).emit("hangupcallfunction", {
        hangup: "hangup"
      });
    }
  })

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

// return all the friends of user
app.get("/getAllFriends", authenticate, async (req, res) => {
  try {
    const id = req.user;
    const data = await userInfo.find({ _id: id }, { friends: 1 });
    res.status(200).json({ data });
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

//create group
app.post("/groups", authenticate, async (req, res) => {
  const { groupName, password, members } = req.body;

  if (!groupName || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const newGroup = new Group({
    groupName,
    password,
    createdBy: req.user,
    members: [req.user, ...members],
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

// Route to remove a user from a group
app.post("/groups/:groupId/leave", async (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.body;

  try {
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if the user is a member of the group
    if (!group.members.includes(userId)) {
      return res
        .status(400)
        .json({ error: "User is not a member of the group" });
    }

    // Pull the userId from the members array
    group.members.pull(userId);

    // Save the updated group
    await group.save();

    res
      .status(200)
      .json({ message: "User successfully removed from the group", group });
  } catch (err) {
    console.error("Error removing user from group:", err);
    res.status(500).json({ error: "Failed to remove user from group" });
  }
});

//for group message
app.post("/groups/:groupId/messages", async (req, res) => {
  const { groupId } = req.params;
  const { text, senderId } = req.body;
  if (!text || !senderId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    let group = await Group.findById(groupId).populate("messages.sender");
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const newMessage = { text, sender: senderId };
    group.messages.push(newMessage);
    group = await group.save();

    // Populate the sender field in the new message object
    await group.populate("messages.sender");

    res.status(201).json(group.messages[group.messages.length - 1]);
  } catch (err) {
    console.error("Error adding message:", err);
    res.status(500).json({ error: "Failed to add message" });
  }
});

// retrive all the message of the specific group
app.get("/groups/:groupId/messages", async (req, res) => {
  const { groupId } = req.params;

  try {
    const group = await Group.findById(groupId).populate({
      path: "messages",
      populate: {
        path: "sender",
        model: "userInformation",
        select: "username", // Select the fields you want to populate
      },
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.status(200).json({ messages: group.messages });
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

//write me the delete route for the group
app.delete("/groups/:groupId", async (req, res) => {
  const { groupId } = req.params;

  try {
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    await group.remove();

    res.status(200).json({ message: "Group deleted successfully" });
  } catch (err) {
    console.error("Error deleting group:", err);
    res.status(500).json({ error: "Failed to delete group" });
  }
});

//get the group in which i am in
app.get("/groups", authenticate, async (req, res) => {
  try {
    const userId = req.user;
    console.log(userId, "userId");
    const groups = await Group.find({
      members: { $in: [userId] },
    });

    res.status(200).json({ groups });
  } catch (error) {
    console.error("Error fetching groups:", error);
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

// Encryption function
function encrypt(text) {
  console.log('non encrypted text ', text)
  let cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const encryptedText = iv.toString('hex') + ':' + encrypted.toString('hex');
  console.log('encrypted text: ', encryptedText)
  return encryptedText;
}

//messages
app.post('/messages', async (req, res) => {
  try {
    const { conversationId, senderId, msg } = req.body;
    console.log('posting msg ', msg)
    const encryptedMsg = encrypt(msg);
    const newMessage = new Message({
      conversationId,
      senderId,
      msg: encryptedMsg
    });

    await newMessage.save();
    console.log(newMessage, 'newMessage');
    res.status(200).json({ message: 'Message saved successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


//get message of conversation of user
// Decryption function
function decrypt(text) {
  let textParts = text.split(':');
  let iv = Buffer.from(textParts.shift(), 'hex');
  let encryptedText = Buffer.from(textParts.join(':'), 'hex');
  let decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Get messages of a conversation of a user
app.get("/messagesCombo/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const messages = await Message.find({ conversationId: id });
    console.log(messages, 'messages');
    const decryptedMessages = messages.map(message => {
      return {
        ...message._doc,
        msg: decrypt(message.msg)
      };
    });

    res.status(200).json({ result: decryptedMessages });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

//heroku
if (process.env.NODE_ENV === "production") {
  app.use(express.static("messenger/build"));
}

server.listen(process.env.PORT || PORT, (err) => {
  if (err) console.log(err);
  console.log("server is running ", PORT);
});
