const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Simple password login
app.post("/login", (req, res) => {
  if (req.body.password === "gunapvt") {
    res.redirect("/index.html?user=" + (req.body.username || "User" + Math.floor(Math.random()*1000)));
  } else {
    res.send("Wrong password. Go back and try again.");
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", socket.id);

    socket.on("signal", (data) => {
      socket.to(data.to).emit("signal", { from: socket.id, signal: data.signal });
    });

    socket.on("message", (msg) => {
      socket.to(roomId).emit("message", msg);
    });
  });

  socket.on("disconnect", () => console.log("User disconnected:", socket.id));
});

server.listen(3000, () => console.log("DROPLIE running on port 3000"));
