const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  text: { type: String, required: true },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "userInformation",
    required: true,
  },
  sentAt: { type: Date, default: Date.now },
});

const groupSchema = new mongoose.Schema({
  groupName: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "userInformation" }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "userInformation",
    required: true,
  },
  messages: [messageSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Group = mongoose.model("Group", groupSchema);

module.exports = Group;
