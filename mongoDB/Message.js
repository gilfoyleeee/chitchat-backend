const mongoose = require("mongoose");

const Message = new mongoose.Schema(
  {
    conversationId: {
      type: String,
    },
    senderId: {
      type: String,
    },
    msg: {
      type: String,
    },
  },
  { timestamps: true }
);

const MessageModel = mongoose.model("Message", Message);

module.exports = MessageModel;

// // const mongoose = require("mongoose");
// // const CryptoJS = require("crypto-js");

// // // Generate a random secret key (you should store this securely in your environment variables)
// // const SECRET_KEY = CryptoJS.lib.WordArray.random(16).toString();

// // const Message = new mongoose.Schema(
// //   {
// //     conversationId: {
// //       type: String,
// //     },
// //     senderId: {
// //       type: String,
// //     },
// //     msg: {
// //       type: String,
// //     },
// //   },
// //   { timestamps: true }
// // );

// // // Encrypt the message before saving
// // Message.pre("save", function (next) {
// //   const plaintext = this.msg;
// //   if (plaintext) {
// //     const encrypted = CryptoJS.AES.encrypt(plaintext, SECRET_KEY).toString();
// //     this.msg = encrypted;
// //   }
// //   next();
// // });

// // // Decrypt the message when retrieving
// // Message.virtual("plaintext").get(function () {
// //   if (this.msg) {
// //     const bytes = CryptoJS.AES.decrypt(this.msg, SECRET_KEY);
// //     return bytes.toString(CryptoJS.enc.Utf8);
// //   }
// //   return "";
// // });

// // const MessageModel = mongoose.model("Message", Message);
// // module.exports = MessageModel;
// const mongoose = require("mongoose");
// const CryptoJS = require("crypto-js");

// // Generate a random secret key (you should store this securely in your environment variables)
// const SECRET_KEY = process.env.SECRET_KEY;

// const Message = new mongoose.Schema(
//   {
//     conversationId: {
//       type: String,
//     },
//     senderId: {
//       type: String,
//     },
//     msg: {
//       type: String,
//       get: function (value) {
//         if (value) {
//           const bytes = CryptoJS.AES.decrypt(value, SECRET_KEY);
//           return bytes.toString(CryptoJS.enc.Utf8);
//         }
//         return "";
//       },
//       set: function (value) {
//         if (value) {
//           const encrypted = CryptoJS.AES.encrypt(value, SECRET_KEY).toString();
//           return encrypted; // Return the encrypted value
//         }
//         return "";
//       },
//     },
//   },
//   { timestamps: true }
// );

// const MessageModel = mongoose.model("Message", Message);
// module.exports = MessageModel;
