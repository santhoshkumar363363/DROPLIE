const socket = io();
let localStream;
let peerConnection;
let joined = false; // prevents multiple joins

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "openai",
      credential: "openai"
    }
  ]
};

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const roomInput = document.getElementById("roomInput");
const joinBtn = document.getElementById("joinBtn");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("messages");

// Remove existing listeners before adding new ones → prevents duplicates
socket.removeAllListeners();

joinBtn.onclick = async () => {
  if (joined) return; // stop repeated joining
  joined = true;

  const roomId = roomInput.value.trim();
  if (!roomId) return alert("Enter room ID");

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  socket.emit("join-room", roomId);

  // Listeners — attached only once
  socket.on("user-connected", (id) => startPeerConnection(id, true));
  socket.on("signal", async ({ from, signal }) => handleSignal(from, signal));

  socket.on("message", (msg) => {
    messages.innerHTML += `<div>${msg}</div>`;
    messages.scrollTop = messages.scrollHeight;
  });
};

sendBtn.onclick = () => {
  const msg = msgInput.value;
  if (!msg) return;
  messages.innerHTML += `<div>You: ${msg}</div>`;
  socket.emit("message", msg);
  msgInput.value = "";
};

function startPeerConnection(id, isOffer) {
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (e) => {
    remoteVideo.srcObject = e.streams[0];
  };

  peerConnection.onicecandidate = (e) => {
    if (!e.candidate) {
      socket.emit("signal", { to: id, signal: peerConnection.localDescription });
    }
  };

  if (isOffer) {
    peerConnection.createOffer().then(offer => {
      peerConnection.setLocalDescription(offer);
      socket.emit("signal", { to: id, signal: offer });
    });
  }
}

async function handleSignal(from, signal) {
  if (!peerConnection) startPeerConnection(from, false);

  await peerConnection.setRemoteDescription(signal);

  if (signal.type === "offer") {
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("signal", { to: from, signal: peerConnection.localDescription });
  }
}
