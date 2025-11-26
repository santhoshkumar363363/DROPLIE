// DROPLIE script.js (final + video sharing fixed)
const socket = io();
let localStream = null;
let pc = null;
let remoteId = null;
let joinedRoom = null;
let username = decodeURIComponent((new URLSearchParams(window.location.search)).get('user') || 'Guest');

const config = {
  iceServers: [
    { urls: "stun:stun1.l.google.com:19302" },
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

// show chat if logged in by password
if (window.location.search.includes('user=')) {
  loginDiv.style.display = 'none';
  chatUI.style.display = 'block';
}

// chat helper
function appendChat(text) {
  const d = document.createElement('div');
  d.textContent = text;
  messages.appendChild(d);
  messages.scrollTop = messages.scrollHeight;
}

// socket events
socket.on('connect', () => {
  console.log("connected", socket.id);
});

// NEW FIX — stable remoteId + delayed offer
socket.on('user-joined', async (data) => {
  remoteId = data.id; // always save peer ID
  appendChat(`${data.user || 'Stranger'} joined room.`);

  // Delay to ensure both cameras + ICE ready
  setTimeout(() => {
    createPeer(true);
  }, 500);
});

socket.on('offer', async ({ from, sdp }) => {
  remoteId = from;
  if (!pc) await createPeer(false);
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', { to: from, sdp: pc.localDescription });
});

socket.on('answer', async ({ sdp }) => {
  if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
});

socket.on('ice-candidate', async ({ candidate }) => {
  if (pc && candidate) {
    try { await pc.addIceCandidate(candidate); } catch (e) {}
  }
});

socket.on('chat-message', ({ user, text }) => {
  appendChat(`${user}: ${text}`);
});

socket.on('user-left', () => {
  appendChat("User disconnected.");
  cleanupPeer();
});

// join room
joinBtn.addEventListener('click', async () => {
  if (joinedRoom) return;
  const room = roomInput.value.trim();
  if (!room) return alert("Enter room ID");

  joinedRoom = room;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (e) {
    return alert("Camera/Microphone error: " + e.message);
  }

  socket.emit("join-room", room, username);
  appendChat("You joined room: " + room);
  joinBtn.style.display = "none";
  leaveBtn.style.display = "inline-block";
});

// send chat
sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keydown', (e) => { if (e.key === "Enter") sendMessage(); });

function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;
  appendChat(`You: ${text}`);
  socket.emit("chat-message", { user: username, text });
  msgInput.value = "";
}

// leave room
leaveBtn.addEventListener('click', () => {
  cleanupPeer();
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localVideo.srcObject = null;
  }
  socket.disconnect();
  setTimeout(() => location.reload(), 200);
});

// create WebRTC connection
async function createPeer(isOffer) {
  pc = new RTCPeerConnection(config);

  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  pc.ontrack = (e) => {
    remoteVideo.srcObject = e.streams[0];
  };

  pc.onicecandidate = (e) => {
    if (e.candidate && remoteId) {
      socket.emit("ice-candidate", { to: remoteId, candidate: e.candidate });
    }
  };

  // FIX: wait for remoteId before making offer
  if (isOffer) {
    if (!remoteId) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { to: remoteId, sdp: pc.localDescription });
  }

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
      appendChat("Connection lost.");
      cleanupPeer();
    }
  };
}

// cleanup peer connection
function cleanupPeer() {
  if (pc) {
    try { pc.close(); } catch (e) {}
    pc = null;
  }
  remoteId = null;
  remoteVideo.srcObject = null;
}
