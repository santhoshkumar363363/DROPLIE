const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });

app.use(express.static(__dirname));

io.on("connection", socket => {
  socket.on("join-room", room => socket.join(room));

  socket.on("offer", offer =>
    socket.to([...socket.rooms][1]).emit("offer", offer)
  );
  socket.on("answer", ans =>
    socket.to([...socket.rooms][1]).emit("answer", ans)
  );
  socket.on("ice", ice =>
    socket.to([...socket.rooms][1]).emit("ice", ice)
  );
  socket.on("message", msg =>
    socket.to([...socket.rooms][1]).emit("message", msg)
  );
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => console.log(`DROPLIE running on ${PORT}`));
