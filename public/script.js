const socket = io();
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("messages");
const leaveBtn = document.getElementById("leaveBtn");

let pc;
let localStream;

async function startCall() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  pc = new RTCPeerConnection();
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
  };

  socket.on("offer", async offer => {
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", answer);
  });

  socket.on("answer", async answer => {
    await pc.setRemoteDescription(answer);
  });

  socket.on("candidate", async candidate => {
    await pc.addIceCandidate(candidate);
  });

  pc.onicecandidate = e => {
    if (e.candidate) socket.emit("candidate", e.candidate);
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", offer);
}

startCall();

/* ---------------- CHAT ---------------- */
sendBtn.addEventListener("click", () => {
  let msg = messageInput.value.trim();
  if (!msg) return;
  socket.emit("message", msg);
  addMessage("You", msg);
  messageInput.value = "";
});

messageInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendBtn.click();
});

socket.on("message", msg => addMessage("Friend", msg));

function addMessage(user, msg) {
  const p = document.createElement("p");
  p.textContent = `${user}: ${msg}`;
  messages.appendChild(p);
  messages.scrollTop = messages.scrollHeight;
}

/* ----------- LEAVE CALL ------------- */
leaveBtn.onclick = () => {
  window.location.href = "/room";
};
