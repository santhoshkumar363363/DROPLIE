// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// simple password check
app.post("/login", (req, res) => {
  if (req.body.password === "gunapvt") {
    const user = encodeURIComponent(req.body.username || ("User" + Math.floor(Math.random() * 10000)));
    res.redirect("/index.html?user=" + user);
  } else {
    res.send("Wrong password. Go back and try again.");
  }
});

io.on("connection", (socket) => {
  console.log("connect", socket.id);

  socket.on("join-room", (roomId, user) => {
    socket.join(roomId);
    // tell others in room that a new user joined plus the new user's socket id
    socket.to(roomId).emit("user-joined", { id: socket.id, user });

    // forward offers/answers/ice-candidates between peers by target id
    socket.on("offer", (data) => {
      if (data.to) io.to(data.to).emit("offer", { from: socket.id, sdp: data.sdp });
    });

    socket.on("answer", (data) => {
      if (data.to) io.to(data.to).emit("answer", { from: socket.id, sdp: data.sdp });
    });

    socket.on("ice-candidate", (data) => {
      if (data.to) io.to(data.to).emit("ice-candidate", { from: socket.id, candidate: data.candidate });
    });

    // chat: send to others in same room (exclude sender)
    socket.on("chat-message", (msg) => {
      socket.to(roomId).emit("chat-message", { from: socket.id, user: msg.user, text: msg.text });
    });

    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-left", { id: socket.id });
    });
  });

  socket.on("disconnect", () => {
    console.log("disconnect", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("DROPLIE listening on", PORT));
