const PASSWORD = "gunapvt";
const socket = io();
let peer, localStream, remoteStream;

// Login
document.getElementById("loginBtn").onclick = () => {
  const u = usernameInput.value.trim();
  const p = passwordInput.value.trim();

  if (!u) return alert("Enter username");
  if (p !== PASSWORD) return loginError.style.display = "block";

  loginBox.style.display = "none";
  mainUI.style.display = "block";
};

// Join / Leave Room
joinBtn.onclick = async () => {
  const room = roomInput.value.trim();
  if (!room) return alert("Enter room ID");

  await startVideo();
  socket.emit("join-room", room);
};

leaveBtn.onclick = () => location.reload();

// Chat
sendBtn.onclick = () => {
  const msg = msgInput.value.trim();
  if (!msg) return;
  addMsg("You", msg);
  socket.emit("message", msg);
  msgInput.value = "";
};

socket.on("message", msg => addMsg("Friend", msg));

function addMsg(user, msg) {
  messages.innerHTML += `<p><b>${user}:</b> ${msg}</p>`;
  messages.scrollTop = messages.scrollHeight;
}

// WebRTC
async function startVideo() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  peer = new RTCPeerConnection();
  remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;

  localStream.getTracks().forEach(t => peer.addTrack(t, localStream));
  peer.ontrack = (e) => e.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));

  peer.onicecandidate = e => e.candidate && socket.emit("ice", e.candidate);
  socket.on("ice", c => peer.addIceCandidate(new RTCIceCandidate(c)));

  socket.on("offer", async offer => {
    await peer.setRemoteDescription(offer);
    const ans = await peer.createAnswer();
    await peer.setLocalDescription(ans);
    socket.emit("answer", ans);
  });

  socket.on("answer", ans => peer.setRemoteDescription(ans));

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit("offer", offer);
}
