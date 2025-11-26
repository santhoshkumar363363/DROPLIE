const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, username) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-joined", username);

    socket.on("offer", data => socket.to(roomId).emit("offer", data));
    socket.on("answer", data => socket.to(roomId).emit("answer", data));
    socket.on("ice", data => socket.to(roomId).emit("ice", data));

    socket.on("message", msg => io.to(roomId).emit("message", msg));

    socket.on("disconnect", () => {
      socket.to(roomId).emit("leave");
    });
  });
});

http.listen(process.env.PORT || 3000, () =>
  console.log("Server running...")
);
