const mongoose = require("mongoose");

mongoose
  .connect(
    "mongodb+srv://prajju:prajju@civic-bridge.p8y7l6b.mongodb.net/",
    { useNewUrlParser: true, useUnifiedTopology: true }
  )
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
  });

//"mongodb+srv://balaganesh102004:ALQPweQ12@cluster0.nsgbb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
//mongodb+srv://prajju:prajju@civic-bridge.p8y7l6b.mongodb.net/
//  mongodb+srv://muralikl312:Murali123@cluster0.szpj3l6.mongodb.net