// script.js (copy-paste exact)
const socket = io();
let localStream = null;
let pc = null;            // RTCPeerConnection (only one, since we support 1:1)
let remoteId = null;      // the other peer's socket id
let joinedRoom = null;
let username = decodeURIComponent((new URLSearchParams(window.location.search)).get('user') || 'Guest');

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // Metered TURN for tough NATs (helps reduce connectivity issues)
    { urls: "turn:global.relay.metered.ca:80", username: "openai", credential: "openai" }
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

// show chat if logged in via ?user=
if (window.location.search.includes('user=')) {
  loginDiv.style.display = 'none';
  chatUI.style.display = 'block';
}

// Helper: append chat line
function appendChat(text, cls = '') {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  d.textContent = text;
  messages.appendChild(d);
  messages.scrollTop = messages.scrollHeight;
}

// Ensure we add event listeners only once
(function wireButtons(){
  joinBtn.addEventListener('click', startJoin);
  leaveBtn.addEventListener('click', leaveRoom);
  sendBtn.addEventListener('click', sendMessage);
  msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
})();

// socket handlers — registered once
socket.on('connect', () => {
  console.log('socket connected', socket.id);
});

socket.on('user-joined', async (data) => {
  // someone else joined the room after you — store their id and create offer
  if (!remoteId && data && data.id) {
    remoteId = data.id;
    appendChat(`${data.user || 'Stranger'} joined. Creating offer...`);
    await createPeer(true);
  }
});

socket.on('offer', async ({ from, sdp }) => {
  // peer sent an offer to us
  remoteId = from;
  if (!pc) await createPeer(false);      // create peer if missing
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', { to: from, sdp: pc.localDescription });
});

socket.on('answer', async ({ from, sdp }) => {
  if (pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }
});

socket.on('ice-candidate', async ({ from, candidate }) => {
  if (pc && candidate) {
    try { await pc.addIceCandidate(candidate); } catch (e) { console.warn('Failed addIce', e); }
  }
});

socket.on('chat-message', ({ from, user, text }) => {
  appendChat(`${user || 'Stranger'}: ${text}`);
});

socket.on('user-left', ({ id }) => {
  if (id === remoteId) {
    appendChat('Peer left the room.');
    cleanupPeer();
  }
});

// start joining room
async function startJoin() {
  if (joinedRoom) return; // already joined
  const room = roomInput.value.trim();
  if (!room) return alert('Enter room ID');
  joinedRoom = room;

  // get media
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (e) {
    alert('Could not get camera/mic: ' + e.message);
    joinedRoom = null;
    return;
  }

  // join server room
  socket.emit('join-room', room, username);
  appendChat('Joined room: ' + room);
  joinBtn.style.display = 'none';
  leaveBtn.style.display = 'inline-block';
}

// leave room & cleanup
function leaveRoom() {
  if (!joinedRoom) return;
  // tell server implicitly by disconnecting from room via reload/leave
  cleanupPeer();
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
    localVideo.srcObject = null;
  }
  socket.disconnect(); // simpler: reconnect afterwards
  setTimeout(() => location.reload(), 250); // reload resets socket and UI
}

// create peer connection and optionally create offer
async function createPeer(isOffer) {
  pc = new RTCPeerConnection(config);

  // add local tracks
  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  pc.ontrack = (ev) => {
    remoteVideo.srcObject = ev.streams[0];
  };

  pc.onicecandidate = (ev) => {
    if (ev.candidate && remoteId) {
      socket.emit('ice-candidate', { to: remoteId, candidate: ev.candidate });
    }
  };

  pc.onconnectionstatechange = () => {
    console.log('pc state', pc.connectionState);
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      appendChat('Connection closed.');
      cleanupPeer();
    }
  };

  if (isOffer && remoteId) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', { to: remoteId, sdp: pc.localDescription });
  }
}

// cleanup peer only (keep socket for chat)
function cleanupPeer() {
  if (pc) {
    try { pc.close(); } catch (e) {}
    pc = null;
  }
  remoteId = null;
  remoteVideo.srcObject = null;
}
 
// send chat message
function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || !joinedRoom) return;
  appendChat(`You: ${text}`);
  socket.emit('chat-message', { user: username, text }); // server will forward to others
  msgInput.value = '';
}
