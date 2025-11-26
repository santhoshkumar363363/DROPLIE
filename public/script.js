// DROPLIE — FINAL BUILD (Optimized for mobile data + Chrome)
const socket = io();
let localStream = null;
let pc = null;
let remoteId = null;
let joinedRoom = null;
let username = decodeURIComponent((new URLSearchParams(window.location.search)).get('user') || 'Guest');

const ICE_CONFIG = {
  iceServers: [
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: [
        "turn:global.relay.metered.ca:443?transport=tcp",
        "turn:global.relay.metered.ca:443"
      ],
      username: "openai",
      credential: "openai"
    }
  ]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const messages = document.getElementById('messages');
const loginDiv = document.getElementById('login');
const chatUI = document.getElementById('chatUI');

// show UI when authenticated
if (window.location.search.includes('user=')) {
  loginDiv.style.display = 'none';
  chatUI.style.display = 'block';
}

function chat(text) {
  const d = document.createElement('div');
  d.textContent = text;
  messages.appendChild(d);
  messages.scrollTop = messages.scrollHeight;
}

socket.on("connect", () => console.log("Connected:", socket.id));

socket.on("user-joined", async ({ id, user }) => {
  remoteId = id;
  chat(`${user || "Stranger"} joined.`);
  setTimeout(() => createPeer(true), 500);
});

socket.on("offer", async ({ from, sdp }) => {
  remoteId = from;
  if (!pc) await createPeer(false);
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { to: from, sdp: pc.localDescription });
});

socket.on("answer", async ({ sdp }) => {
  if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
});

socket.on("ice-candidate", async ({ candidate }) => {
  if (pc && candidate) try { await pc.addIceCandidate(candidate); } catch {}
});

socket.on("chat-message", ({ user, text }) => {
  chat(`${user}: ${text}`);
});

socket.on("user-left", () => {
  chat("User left the room.");
  cleanupPeer();
});

joinBtn.onclick = async () => {
  if (joinedRoom) return;
  const room = roomInput.value.trim();
  if (!room) return alert("Enter a room ID");

  joinedRoom = room;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    localVideo.muted = true;
    localVideo.srcObject = localStream;
    localVideo.play().catch(() => {});
  } catch (err) {
    alert("Camera/Mic Blocked: " + err.message);
    joinedRoom = null;
    return;
  }

  socket.emit("join-room", room, username);
  chat("Joined room: " + room);
  joinBtn.style.display = "none";
  leaveBtn.style.display = "inline-block";
};

sendBtn.onclick = sendMessage;
msgInput.onkeydown = e => (e.key === "Enter" ? sendMessage() : null);

function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;
  chat(`You: ${text}`);
  socket.emit("chat-message", { user: username, text });
  msgInput.value = "";
}

leaveBtn.onclick = () => {
  cleanupPeer();
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localVideo.srcObject = null;
  }
  socket.disconnect();
  location.reload();
};

async function createPeer(isOffer) {
  pc = new RTCPeerConnection(ICE_CONFIG);

  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  pc.getSenders().forEach(sender => {
    if (!sender.track && localStream) {
      localStream.getTracks().forEach(track => sender.replaceTrack(track));
    }
  });

  pc.ontrack = (e) => {
    remoteVideo.srcObject = e.streams[0];
    remoteVideo.play().catch(() => {}); // ← Chrome Android autoplay fix
  };

  pc.onicecandidate = (e) => {
    if (e.candidate && remoteId) {
      socket.emit("ice-candidate", { to: remoteId, candidate: e.candidate });
    }
  };

  pc.onnegotiationneeded = async () => {
    if (!remoteId) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { to: remoteId, sdp: pc.localDescription });
  };

  pc.onconnectionstatechange = () => {
    if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
      chat("Reconnecting video...");
      setTimeout(() => createPeer(true), 600);
    }
  };

  if (isOffer) {
    if (!remoteId) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { to: remoteId, sdp: pc.localDescription });
  }
}

function cleanupPeer() {
  if (pc) {
    try { pc.close(); } catch {}
    pc = null;
  }
  remoteId = null;
  remoteVideo.srcObject = null;
              }
