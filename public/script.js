const socket = io();
let localStream, peerConnection;
const config = { iceServers:[{urls:"stun:stun.l.google.com:19302"}] };

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const roomInput = document.getElementById("roomInput");
const joinBtn = document.getElementById("joinBtn");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("messages");

const chatDiv = document.getElementById("chat");
const loginDiv = document.getElementById("login");

// Show chat if user is logged in
if (window.location.search.includes("user=")) {
  loginDiv.style.display = "none";
  chatDiv.style.display = "block";
}

joinBtn.onclick = async () => {
  const roomId = roomInput.value.trim();
  if (!roomId) return alert("Enter room ID");

  localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
  localVideo.srcObject = localStream;

  socket.emit("join-room", roomId);

  socket.on("user-connected", (id) => createPeer(id, true));
  socket.on("signal", async ({from, signal}) => {
    if (!peerConnection) createPeer(from, false);
    await peerConnection.setRemoteDescription(signal);
    if(signal.type === "offer"){
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit("signal", {to:from, signal:peerConnection.localDescription});
    }
  });

  socket.on("message", (msg) => {
    messages.innerHTML += `<div>${msg}</div>`;
    messages.scrollTop = messages.scrollHeight;
  });
};

sendBtn.onclick = () => {
  const msg = msgInput.value;
  if(!msg) return;
  messages.innerHTML += `<div>You: ${msg}</div>`;
  socket.emit("message", msg);
  msgInput.value = "";
};

function createPeer(id, isOffer){
  peerConnection = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = e => remoteVideo.srcObject = e.streams[0];

  peerConnection.onicecandidate = e => {
    if(e.candidate) return;
    socket.emit("signal", {to:id, signal:peerConnection.localDescription});
  };

  if(isOffer){
    peerConnection.createOffer().then(offer => {
      peerConnection.setLocalDescription(offer);
      socket.emit("signal",{to:id, signal:offer});
    });
  }
}
