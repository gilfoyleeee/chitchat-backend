const mongoose = require("mongoose");
const url =
  "mongodb+srv://kushalthapa:kushalthapa@cluster0.vfqmjsq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
mongoose
  .connect(url, {
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("mongodb is connected");
  })
  .catch((err) => {
    console.log(err);
  });
